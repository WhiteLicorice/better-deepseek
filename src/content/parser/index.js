/**
 * Main BDS message parser.
 *
 * Parses raw message text and extracts:
 * - Control tags (LONG_WORK open/close)
 * - Renderable tool blocks (HTML, LaTeX, Python)
 * - create_file entries
 * - memory_write entries
 * - Sanitized visible text
 */

import {
  parseTagAttributes,
  normalizeTaggedCodeContent,
} from "./tag-parser.js";
import { parseMemoryWrite } from "./memory-parser.js";
import { sanitizeVisibleText } from "./text-sanitizer.js";

// Tool renderers that have visual cards
const RENDERABLE_TOOLS = new Set(["html", "latex", "visualizer", "pptx", "excel", "docx", "ask_question"]);

/**
 * Strip markdown code fences and their content from text.
 * Returns text safe for BDS tag presence detection — prevents false
 * positives when AI explains BDS syntax inside code examples.
 */
function stripMarkdownCodeFences(text) {
  return String(text || "").replace(/```[^\n]*\r?\n[\s\S]*?\r?\n\s*```/g, "");
}

/**
 * Parse a raw message text for all BDS tags.
 */
export function parseBdsMessage(rawText, isSettled = false) {
  let text = String(rawText || "");

  // Intercept unclosed tags if the message is fully settled (AI stopped generating).
  // This prevents infinite "Working..." animations and lost tool output.
  if (isSettled) {
    const unclosedTags = [];
    const allTags = Array.from(text.matchAll(/<\/?BDS:([A-Za-z0-9_]+)[^>]*>/gi));
    for (const match of allTags) {
      const isClose = match[0].startsWith('</');
      const tName = match[1].toLowerCase();
      
      // AUTO tags are background requests lacking standard rendering lifecycle
      if (tName.startsWith("auto")) continue;

      if (!isClose) {
        unclosedTags.push(match[1]);
      } else {
        const idx = unclosedTags.map(t => t.toLowerCase()).lastIndexOf(tName);
        if (idx !== -1) {
          unclosedTags.splice(idx, 1);
        }
      }
    }
    
    // Auto-close anything left gracefully
    for (let i = unclosedTags.length - 1; i >= 0; i--) {
      text += `\n</BDS:${unclosedTags[i]}>\n`;
    }
  }

  const result = {
    containsControlTags: false,
    longWorkOpen: false,
    longWorkClose: false,
    renderableBlocks: [],
    createFiles: [],
    memoryWrites: [],
    characterCreates: [],
    askQuestions: [],
    autoRequests: {
      webFetch: [],
      githubFetch: [],
      twitterFetch: [],
      youtubeFetch: []
    },
    visibleText: text,
  };

  // Check original text for BDS tag PRESENCE. Must use original (not
  // fence-stripped) text here — AI may wrap legitimate LONG_WORK/Artifact
  // blocks in ``` fences, and stripping first would lose all tags.
  if (!/(<BDS:|<BetterDeepSeek>|Bds create file>)/i.test(text)) {
    return result;
  }

  // We have BDS tags, but do we have tags that should HIDE the original message?
  // AUTO tags should NOT hide the message.
  const hasHidingTags = /(<BDS:(?!AUTO)[a-zA-Z0-9_]+|<BetterDeepSeek>|Bds create file>)/i.test(text);
  result.containsControlTags = hasHidingTags;
  result.longWorkOpen = /<BDS:LONG_WORK>/i.test(text);
  result.longWorkClose = /<\/BDS:LONG_WORK>/i.test(text);

  // Strip code fences for streaming detection only. This prevents false
  // positive "Working..." overlays when AI explains BDS syntax inside code
  // examples. Content extraction (create_file, renderable blocks, etc.)
  // still uses the original text above.
  const tagScanText = stripMarkdownCodeFences(text);

  // Parse create_file pair tags independently so nested files inside LONG_WORK are captured.
  const createFilePairRegex =
    /<BDS:create_file([^>]*)>([\s\S]*?)<\/BDS:create_file>/gi;
  let match;
  while ((match = createFilePairRegex.exec(text)) !== null) {
    const attrs = parseTagAttributes(match[1] || "");
    const fileName = attrs.fileName || attrs.filename || attrs.path;
    if (!fileName) {
      continue;
    }
    const content = normalizeTaggedCodeContent(
      String(match[2] || ""),
      "create_file"
    );
    result.createFiles.push({ fileName, content });
  }

  const pairTagRegex =
    /<BDS:([A-Za-z0-9_]+)([^>]*)>([\s\S]*?)<\/BDS:\1>/gi;
  match = null;
  while ((match = pairTagRegex.exec(text)) !== null) {
    const name = String(match[1] || "").toLowerCase();
    const attrs = parseTagAttributes(match[2] || "");
    const content = normalizeTaggedCodeContent(
      String(match[3] || ""),
      name
    );

    if (RENDERABLE_TOOLS.has(name)) {
      result.renderableBlocks.push({ name, attrs, content });
    }

    if (name === "memory_write") {
      const parsedMemory = parseMemoryWrite(content);
      if (parsedMemory) {
        result.memoryWrites.push(parsedMemory);
      }
    }

    if (name === "character_create") {
      result.characterCreates.push({
        name: attrs.name || "New Character",
        usage: attrs.usage || attrs.kullanim_alani || "",
        content: content
      });
    }

    if (name === "ask_question") {
      try {
        const questions = JSON.parse(content);
        if (Array.isArray(questions)) {
          result.askQuestions = questions;
        }
      } catch (e) {
        console.error("Failed to parse ask_question JSON:", e);
      }
    }
  }

  const autoWebFetchRegex = /<BDS:AUTO:REQUEST_WEB_FETCH>([\s\S]*?)<\/BDS:AUTO:REQUEST_WEB_FETCH>/gi;
  while ((match = autoWebFetchRegex.exec(text)) !== null) {
     const cleanUrl = String(match[1] || "").trim();
     if (cleanUrl) {
       result.autoRequests.webFetch.push(cleanUrl);
     }
  }

  const autoGitHubFetchRegex = /<BDS:AUTO:REQUEST_GITHUB_FETCH>([\s\S]*?)<\/BDS:AUTO:REQUEST_GITHUB_FETCH>/gi;
  while ((match = autoGitHubFetchRegex.exec(text)) !== null) {
     const cleanUrl = String(match[1] || "").trim();
     if (cleanUrl) {
       result.autoRequests.githubFetch.push(cleanUrl);
     }
  }

  const autoTwitterFetchRegex = /<BDS:AUTO:REQUEST_TWITTER_FETCH>([\s\S]*?)<\/BDS:AUTO:REQUEST_TWITTER_FETCH>/gi;
  while ((match = autoTwitterFetchRegex.exec(text)) !== null) {
     const cleanUrl = String(match[1] || "").trim();
     if (cleanUrl) {
       result.autoRequests.twitterFetch.push(cleanUrl);
     }
  }

  const autoYouTubeFetchRegex = /<BDS:AUTO:REQUEST_YOUTUBE_FETCH>([\s\S]*?)<\/BDS:AUTO:REQUEST_YOUTUBE_FETCH>/gi;
  while ((match = autoYouTubeFetchRegex.exec(text)) !== null) {
     const cleanUrl = String(match[1] || "").trim();
     if (cleanUrl) {
       result.autoRequests.youtubeFetch.push(cleanUrl);
     }
  }

  const selfClosingCreateRegex = /<BDS:create_file([^>]*)\/>/gi;
  while ((match = selfClosingCreateRegex.exec(text)) !== null) {
    const attrs = parseTagAttributes(match[1] || "");
    const fileName = attrs.fileName || attrs.filename || attrs.path;
    if (!fileName) {
      continue;
    }
    const content = normalizeTaggedCodeContent(
      String(attrs.content || ""),
      "create_file"
    );
    result.createFiles.push({ fileName, content });
  }

  const plainCreateRegex =
    /Bds create file>\s*fileName\s*=\s*"([^"]+)"\s*content\s*=\s*"([\s\S]*?)"/gi;
  while ((match = plainCreateRegex.exec(text)) !== null) {
    result.createFiles.push({
      fileName: String(match[1] || "file.txt"),
      content: normalizeTaggedCodeContent(
        String(match[2] || ""),
        "create_file"
      ),
    });
  }

  result.visibleText = sanitizeVisibleText(text);

  // UNIVERSAL INTERFACE LOCK: Detect if ANY BDS tag is currently open (not closed).
  // This handles streaming for all tools (Visualizer, LongWork, etc.).
  //
  // Scan the fence-stripped text to avoid false positives when AI explains
  // BDS syntax inside markdown code blocks. Real BDS tags live outside fences.
  const scanOpenTags = Array.from(tagScanText.matchAll(/<BDS:([A-Za-z0-9_]+)[^>]*>/gi));
  const scanCloseTags = Array.from(tagScanText.matchAll(/<\/BDS:([A-Za-z0-9_]+)>/gi));

  // Determine if there's an open tag that hasn't been closed yet.
  // Find the last open tag and check if a close tag for it exists after it.
  let streamingTagName = null;
  let streamingTagStartIdx = -1;

  for (let i = scanOpenTags.length - 1; i >= 0; i--) {
    const openTag = scanOpenTags[i];
    const tagName = openTag[1].toLowerCase();

    // EXCEPTION: AUTO tags are background instructions/requests,
    // they should never trigger the UI's "Working..." overlay.
    if (tagName.startsWith("auto")) continue;

    // Check if this specific tag name has a close tag appearing after this open tag
    const hasClose = scanCloseTags.some(ct =>
      ct[1].toLowerCase() === tagName && ct.index > openTag.index
    );

    if (!hasClose) {
      streamingTagName = tagName;
      // The tag is confirmed streaming (real BDS tag, not in a code fence).
      // Now find its position in the ORIGINAL text for correct truncation.
      // Re-scan original text for the same tag name to get the right index.
      const origAllOpen = Array.from(text.matchAll(/<BDS:([A-Za-z0-9_]+)[^>]*>/gi));
      const origAllClose = Array.from(text.matchAll(/<\/BDS:([A-Za-z0-9_]+)>/gi));
      for (let j = origAllOpen.length - 1; j >= 0; j--) {
        const ot = origAllOpen[j];
        if (ot[1].toLowerCase() !== tagName) continue;
        const hasOrigClose = origAllClose.some(ct =>
          ct[1].toLowerCase() === tagName && ct.index > ot.index
        );
        if (!hasOrigClose) {
          streamingTagStartIdx = ot.index;
          break;
        }
      }
      break;
    }
  }

  result.isStreamingTool = streamingTagStartIdx !== -1;
  result.streamingTagName = streamingTagName;

  if (result.isStreamingTool) {
    // Cut off visibility at the start of the FIRST open tool tag
    // (In case there are multiple, though unlikely)
    result.visibleText = sanitizeVisibleText(text.substring(0, streamingTagStartIdx));
  }

  return result;
}
