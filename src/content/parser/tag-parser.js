/**
 * Parse tag attributes from a string like: fileName="test.py" content="..."
 */
export function parseTagAttributes(rawAttrs) {
  const attrs = {};
  const regex = /([A-Za-z0-9_:-]+)\s*=\s*"([\s\S]*?)"/g;

  let match;
  while ((match = regex.exec(rawAttrs)) !== null) {
    const key = String(match[1] || "").trim();
    if (!key) {
      continue;
    }

    if (key === "fileName") {
      attrs.fileName = String(match[2] || "");
    } else {
      attrs[key] = String(match[2] || "");
    }
  }

  return attrs;
}

/**
 * Normalize content extracted from a BDS tag.
 */
export function normalizeTaggedCodeContent(content, tagName) {
  const name = String(tagName || "").toLowerCase();
  let output = String(content || "");

  if (
    name === "create_file" ||
    name === "run_python_embed" ||
    name === "html" ||
    name === "latex" ||
    name === "visualizer" ||
    name === "docx" ||
    name === "pptx" ||
    name === "excel"
  ) {
    output = unwrapMarkdownCodeFence(output);
  }

  if (
    name === "run_python_embed" ||
    name === "html" ||
    name === "docx" ||
    name === "pptx" ||
    name === "excel"
  ) {
    output = stripLeadingChatter(output);
  }

  return stripMarkdownViewerControls(output);
}

/**
 * Strips leading/trailing conversational text from a code block.
 * Specifically targets cases where AI ignores markdown fences and writes:
 * "Here is the code: const doc = ..."
 */
function stripLeadingChatter(content) {
  let output = String(content || "").trim();

  // If it already looks like it starts with code, leave it
  if (/^(?:const|let|var|function|async|import|export|class|await|\/\/|\/\*)/.test(output)) {
    return output;
  }

  // Look for the first occurrence of a JS keyword at the start of a line
  const jsStartMatch = output.match(/(?:\r?\n|^)\s*(const|let|var|function|async|import|class|await|document)\s+/);
  if (jsStartMatch && jsStartMatch.index > 0) {
    console.log(`[BDS:Parser] Stripping leading chatter for JS block: "${output.substring(0, 30)}..."`);
    return output.substring(jsStartMatch.index).trim();
  }

  return output;
}

/**
 * Unwrap markdown code fences from content ONLY when the entire content
 * is a single fenced code block (from start to end, ignoring surrounding
 * whitespace). Does NOT extract code blocks from mixed content like README
 * files that have prose + code examples — those must stay intact.
 */
export function unwrapMarkdownCodeFence(content) {
  const original = String(content || "");

  // Anchored: ^\s*``` ... ```\s*$ — only matches when the whole content
  // is one code fence. Prevents extracting the first inner ``` block
  // from mixed files (e.g., README.md with text + code examples).
  const regex = /^\s*```[^\n]*\r?\n([\s\S]*?)\r?\n\s*```\s*$/;
  const match = original.match(regex);

  if (match) {
    return String(match[1] || "").trim();
  }

  return original.trim();
}

/**
 * Strip DeepSeek's markdown viewer control text (Copy/Download buttons).
 */
export function stripMarkdownViewerControls(text) {
  let output = String(text || "");
  let previous = "";

  const languagePattern =
    "(?:python|javascript|typescript|tsx|jsx|html|css|json|bash|shell|sh|sql|yaml|yml|xml|markdown|md)";

  while (output !== previous) {
    previous = output;

    // TODO: This logic currently only handles Turkish and English UI labels.
    // In the future, a more robust/generalized approach for stripping 
    // AI-generated UI controls should be implemented.
    output = output.replace(
      new RegExp(
        // Strip DeepSeek's UI buttons (Copy/Download) that sometimes get captured.
        // Use \\s+ as separator so same-line buttons ("python Copy Download") also match.
        // 'm' flag so ^ matches start of every line, not just start of string.
        `^\\s*${languagePattern}\\s+(?:Kopyala|Copy)\\s+(?:İndir|Download)\\s*`,
        "im"
      ),
      ""
    );

    output = output.replace(
      // Support matching buttons without preceding language name
      /^\s*(?:Kopyala|Copy)\s+(?:İndir|Download)\s*/im,
      ""
    );
  }

  return output;
}
