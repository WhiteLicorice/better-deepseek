/**
 * Extract raw text from a message DOM node using the best available source.
 */

import { stripMarkdownViewerControls } from "../parser/tag-parser.js";

/**
 * Extract the raw text from a message node, choosing the best source.
 */
export function extractMessageRawText(node) {
  return parseNodeWithBestTextSource(node);
}

/**
 * Extract code directly from a <pre><code> DOM element inside a message node.
 * This bypasses all text extraction and markdown mangling, giving us the
 * verbatim code content with perfect indentation.
 *
 * DeepSeek's markdown renderer converts ```python...``` into a
 * <pre><code class="language-python"> element. Inside this element,
 * ALL whitespace is preserved exactly as the AI wrote it.
 * This is immune to:
 *  - Indentation stripping (markdown code block syntax)
 *  - __name__ → <strong>name</strong> (markdown bold)
 *  - Copy/Download button text contamination
 */
export function extractCodeFromDomNode(node) {
  if (!node) return "";

  // Prefer a language-tagged code block (from a fenced ```python block)
  const langCode = node.querySelector(
    'pre code[class*="language-python"], pre code[class*="language-py"]'
  );
  if (langCode) {
    return langCode.textContent || "";
  }

  // Fall back to any <pre><code> block that looks substantial
  const allCodeBlocks = node.querySelectorAll("pre code");
  let best = "";
  for (const el of allCodeBlocks) {
    const text = el.textContent || "";
    if (text.trim().length > best.length) {
      best = text;
    }
  }

  return best;
}

function parseNodeWithBestTextSource(node) {
  const candidates = getNodeTextCandidates(node);
  if (!candidates.length) {
    return "";
  }

  const tagCandidates = candidates.filter((value) =>
    /<BDS:|<BetterDeepSeek>/i.test(value)
  );
  const pool = tagCandidates.length ? tagCandidates : candidates;

  const selected =
    pool.sort(
      (a, b) => scoreRawTextCandidate(b) - scoreRawTextCandidate(a)
    )[0] || "";
  return stripMarkdownViewerControls(selected);
}

/**
 * Extract text from innerHTML, preserving BDS tags even when DeepSeek's
 * markdown renderer turns them into actual HTML elements.
 *
 * DeepSeek may render `<BDS:TAG>` either as:
 *  (a) escaped text in the DOM: `&lt;BDS:TAG&gt;` (textContent includes tag name)
 *  (b) actual HTML elements: DOM has `<bds:tag>` or similar (textContent MISSES tag name)
 *
 * For case (b), textContent loses the tag names entirely. This function
 * recovers them by processing innerHTML which preserves the tag names in
 * serialized form.
 */
function extractTextWithBdsTags(html) {
  let text = String(html || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

  // Step 1: Capture BDS tags FIRST — before converting <pre><code> blocks.
  // BDS tags inside code blocks (documentation/examples) remain as sentinels
  // and become part of the code content, not control tags.
  const bdsMap = [];
  text = text.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9_:.-]*)([^>]*)>/g,
    (match, isClose, tagName, attrs) => {
      if (/^BDS[:_]/i.test(tagName)) {
        const upperName = tagName
          .toUpperCase()
          .replace(/^BDS[:_]/, "");
        const canonical = isClose
          ? `</BDS:${upperName}>`
          : `<BDS:${upperName}${attrs}>`;
        bdsMap.push(canonical);
        return `\x00BDS${bdsMap.length - 1}\x00`;
      }
      return match;
    }
  );

  // Step 2: Convert <pre><code> blocks to markdown fences using live DOM
  // parsing. Regex-based extraction loses whitespace when syntax highlighters
  // wrap tokens in <span> elements — DOM textContent preserves it perfectly.
  try {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text;
    const preEls = Array.from(tempDiv.querySelectorAll("pre"));

    for (const pre of preEls) {
      const code = pre.querySelector("code");
      if (!code) continue;
      const langMatch = code.className.match(/language-(\w+)/i);
      const lang = langMatch ? langMatch[1] : "";
      // textContent from live DOM preserves every space, tab, and `#`
      const codeText = code.textContent;
      const fence = "\n```" + lang + "\n" + codeText.trimEnd() + "\n```\n";
      // insertAdjacentText inserts as plain text — no HTML parsing, so
      // < > & in code stay literal.
      pre.insertAdjacentText("afterend", fence);
      pre.remove();
    }

    text = tempDiv.innerHTML;
    // The browser re-encodes < > & as HTML entities when serializing
    // innerHTML. Re-decode so the code content has literal characters.
    text = text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"');
  } catch (_) {
    // DOM parsing may fail on severely malformed HTML.
    // Keep the text as-is; it's better than nothing.
  }

  // Step 3: Convert heading, list, and inline elements to markdown.
  text = text.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, level, content) =>
      "\n" + "#".repeat(parseInt(level)) + " " + content.trim() + "\n"
  );
  text = text.replace(
    /<li[^>]*>([\s\S]*?)<\/li>/gi,
    (_, content) => "\n- " + content.trim() + "\n"
  );
  text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");

  // Step 4: HTML-to-text: add newlines after block elements
  text = text.replace(
    /<\/(p|div|li|pre|code|blockquote|h[1-6])>/gi,
    "\n"
  );

  // Step 5: Strip remaining HTML tags (BDS tags are sentinel placeholders,
  // <pre><code>, headings, and lists already converted to markdown)
  text = text.replace(/<[^>]*>/g, "");

  // Step 6: Restore BDS tags from placeholders
  text = text.replace(/\x00BDS(\d+)\x00/g, (_, idx) => {
    return bdsMap[parseInt(idx)] || "";
  });

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function getNodeTextCandidates(node) {
  // Instead of innerText (which fails on detached clones),
  // we'll filter out thinking blocks and then use textContent.

  const clone = node.cloneNode(true);

  // Remove Thinking blocks and other non-content UI elements
  const selectorsToRemove = [
    ".ds-think-content",
    "[class*=\"think\"]",
    "._5255ff8", // "Thought for X seconds"
    "._60aa7fb", // "Found X web pages"
    ".e4c3fd02", // "Read X pages" list
    "._74c0879", // Collapsible area title
    ".ds-icon",
    ".ds-icon-button",
    "div[role=\"button\"]"
  ];

  for (const selector of selectorsToRemove) {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  }

  // decodeNodeHtmlText already uses textContent internally but handles line breaks
  const html = clone.innerHTML || "";
  const htmlDecoded = decodeNodeHtmlText(html);
  const textContent = String(clone.textContent || "");
  const bdsText = extractTextWithBdsTags(html);

  // Raw API response markdown — captured before DeepSeek's renderer strips
  // whitespace from code blocks. Has perfect indentation and BDS tags.
  // Only use if stored recently (<60s) to avoid stale data from other tabs.
  let rawMarkdown = "";
  try {
    const ts = parseInt(localStorage.getItem("bds_raw_latest_ts") || "0", 10);
    if (Date.now() - ts < 60000) {
      rawMarkdown = localStorage.getItem("bds_raw_latest") || "";
    }
  } catch (_) {}

  return [bdsText, htmlDecoded, textContent, rawMarkdown].filter(
    (value) => value && value.trim()
  );
}

function decodeNodeHtmlText(html) {
  const htmlWithBreaks = String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|pre|code|blockquote|h[1-6])>/gi, "\n");

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlWithBreaks, "text/html");
  return String(doc.body.textContent || "");
}

function scoreRawTextCandidate(value) {
  const text = String(value || "");
  const lineBreakCount = (text.match(/\n/g) || []).length;
  const tagCount = (text.match(/<BDS:|<BetterDeepSeek>/gi) || []).length;
  return tagCount * 10000 + lineBreakCount * 100 + text.length;
}

/**
 * Reconstruct markdown from a rendered message node.
 * This is used for exporting when the original markdown source is not available.
 */
export function extractMessageMarkdown(node) {
  if (!node) return "";
  
  const clone = node.cloneNode(true);
  
  // Remove noise first
  const noiseSelectors = [
    ".ds-think-content",
    "[class*=\"think\"]",
    "._5255ff8",
    "._60aa7fb",
    ".e4c3fd02",
    "._74c0879",
    ".ds-icon",
    ".ds-icon-button",
    "div[role=\"button\"]"
  ];
  for (const s of noiseSelectors) {
    clone.querySelectorAll(s).forEach(el => el.remove());
  }

  // Find the markdown container
  const container = clone.querySelector(".ds-markdown") || clone;
  return htmlToMarkdown(container).trim();
}

function htmlToMarkdown(element) {
  let markdown = "";
  
  for (const child of element.childNodes) {
    if (child.nodeType === 3) { // TEXT_NODE
      markdown += child.textContent;
    } else if (child.nodeType === 1) { // ELEMENT_NODE
      const tag = child.tagName.toLowerCase();
      const content = htmlToMarkdown(child);
      
      switch (tag) {
        case "h1": markdown += `\n# ${content}\n`; break;
        case "h2": markdown += `\n## ${content}\n`; break;
        case "h3": markdown += `\n### ${content}\n`; break;
        case "h4": markdown += `\n#### ${content}\n`; break;
        case "h5": markdown += `\n##### ${content}\n`; break;
        case "h6": markdown += `\n###### ${content}\n`; break;
        case "strong": case "b": markdown += `**${content}**`; break;
        case "em": case "i": markdown += `*${content}*`; break;
        case "code": 
          // If it's inside a pre, we handle it in the pre case
          if (child.parentElement?.tagName.toLowerCase() === "pre") {
            markdown += content;
          } else {
            markdown += `\`${content}\``;
          }
          break;
        case "pre": 
          const lang = child.querySelector("code")?.className?.match(/language-(\w+)/)?.[1] || "";
          markdown += `\n\`\`\`${lang}\n${child.textContent.trim()}\n\`\`\`\n`; 
          break;
        case "p": markdown += `\n${content}\n`; break;
        case "ul": markdown += `\n${content}\n`; break;
        case "ol": markdown += `\n${content}\n`; break;
        case "li": markdown += `\n- ${content}`; break;
        case "blockquote": markdown += `\n> ${content.trim()}\n`; break;
        case "a": markdown += `[${content}](${child.getAttribute("href") || "#"})`; break;
        case "br": markdown += `\n`; break;
        default: markdown += content;
      }
    }
  }
  
  // Clean up excessive newlines
  return markdown.replace(/\n{3,}/g, "\n\n");
}
