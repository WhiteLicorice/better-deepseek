/**
 * Python Code Block Run-Button Injector
 *
 * Scans the page for DeepSeek-rendered Python code blocks (`.md-code-block`)
 * and injects a "▶ Run" button into each one's banner.  Clicking the button
 * extracts `textContent` from the <pre> element (which has perfect indentation)
 * and opens an inline Pyodide runner.
 *
 * This completely bypasses BDS tag parsing — the AI just writes normal Python
 * code and DeepSeek renders it naturally with syntax highlighting.
 */

import { buildPythonRunnerDocument } from "../../lib/utils/html-utils.js";
import { triggerTextDownload } from "../../lib/utils/download.js";

const processedBlocks = new WeakSet();

/**
 * Scan a DOM subtree for Python code blocks and inject Run buttons.
 * Safe to call repeatedly — blocks are tracked via a WeakSet.
 */
export function injectPythonRunButtons(rootNode) {
  if (!rootNode) return;

  const codeBlocks = rootNode.querySelectorAll(".md-code-block");

  for (const block of codeBlocks) {
    if (processedBlocks.has(block)) continue;

    if (!isPythonCodeBlock(block)) continue;

    const preEl = block.querySelector("pre");
    if (!preEl) continue;

    processedBlocks.add(block);
    injectButton(block, preEl);
  }
}

// ── Detection ────────────────────────────────────────────────────────────────

function isPythonCodeBlock(block) {
  // Strategy 1: look for "python" / "py" in any span inside the banner
  const banner =
    block.querySelector(".md-code-block-banner") ||
    block.querySelector('[class*="code-block-banner"]');
  if (banner) {
    const spans = banner.querySelectorAll("span");
    for (const span of spans) {
      const t = span.textContent.trim().toLowerCase();
      if (t === "python" || t === "py" || t === "python3") return true;
    }
  }

  // Strategy 2: look for a <code class="language-python"> inside <pre>
  const codeEl = block.querySelector(
    'pre code[class*="language-python"], pre code[class*="language-py"]'
  );
  if (codeEl) return true;

  // Strategy 3: check token classes for Python-specific syntax
  if (block.querySelector('.token.keyword + .token.function')) {
    // Could be any language — but if we also see "def" or "import", it's Python
    const text = block.querySelector("pre")?.textContent || "";
    if (/^(import |from |def |class )/m.test(text)) return true;
  }

  return false;
}

// ── Injection ────────────────────────────────────────────────────────────────

function injectButton(block, preEl) {
  const btnContainer = findButtonContainer(block);

  const runBtn = document.createElement("button");
  runBtn.type = "button";
  runBtn.setAttribute("role", "button");
  runBtn.className = "bds-run-python-btn";
  runBtn.innerHTML =
    '<span style="margin-right:4px">▶</span><span>Run</span>';
  applyButtonStyle(runBtn);

  let panelEl = null;

  runBtn.addEventListener("click", () => {
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
      runBtn.innerHTML =
        '<span style="margin-right:4px">▶</span><span>Run</span>';
      applyButtonStyle(runBtn);
      return;
    }

    const code = preEl.textContent || "";
    panelEl = createRunnerPanel(code);
    // Insert after the code block
    block.parentNode.insertBefore(panelEl, block.nextSibling);

    runBtn.innerHTML =
      '<span style="margin-right:4px">✕</span><span>Close</span>';
    runBtn.style.background = "#ef4444";
  });

  if (btnContainer) {
    btnContainer.insertBefore(runBtn, btnContainer.firstChild);
  } else {
    // Fallback: append to the banner
    const banner =
      block.querySelector(".md-code-block-banner") ||
      block.querySelector('[class*="code-block-banner"]');
    if (banner) {
      banner.appendChild(runBtn);
    }
  }
}

function findButtonContainer(block) {
  // Find via .code-info-button-text (DeepSeek's Copy/Download label class)
  const btnText = block.querySelector(".code-info-button-text");
  if (btnText) {
    const btn = btnText.closest("button");
    if (btn && btn.parentElement) return btn.parentElement;
  }

  // Fallback: find via .ds-atom-button
  const dsBtn = block.querySelector(".ds-atom-button");
  if (dsBtn && dsBtn.parentElement) return dsBtn.parentElement;

  return null;
}

function applyButtonStyle(el) {
  Object.assign(el.style, {
    display: "inline-flex",
    alignItems: "center",
    background: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "4px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    marginRight: "6px",
    transition: "background 0.15s ease",
    lineHeight: "1.4",
    verticalAlign: "middle",
  });
}

// ── Runner Panel ─────────────────────────────────────────────────────────────

function createRunnerPanel(code) {
  const panel = document.createElement("div");
  panel.className = "bds-python-runner-panel";
  Object.assign(panel.style, {
    margin: "6px 0 14px 0",
    borderRadius: "0 0 12px 12px",
    overflow: "hidden",
    border: "1px solid #334155",
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
  });

  // Header bar
  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px",
    background: "#111827",
    borderBottom: "1px solid #334155",
    fontFamily: "sans-serif",
  });

  const title = document.createElement("span");
  title.textContent = "Python Runner — Pyodide WASM";
  Object.assign(title.style, {
    fontSize: "12px",
    fontWeight: "600",
    color: "#9ca3af",
  });

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.textContent = "↓ Download .py";
  Object.assign(downloadBtn.style, {
    fontSize: "11px",
    fontWeight: "600",
    padding: "3px 10px",
    border: "1px solid #374151",
    borderRadius: "4px",
    background: "#1f2937",
    color: "#d1d5db",
    cursor: "pointer",
  });
  downloadBtn.addEventListener("click", () => {
    triggerTextDownload(code, `script-${Date.now()}.py`);
  });

  header.appendChild(title);
  header.appendChild(downloadBtn);

  // Iframe
  const iframe = document.createElement("iframe");
  iframe.title = "Python Runner";
  iframe.sandbox = "allow-scripts";
  iframe.srcdoc = buildPythonRunnerDocument(code);
  Object.assign(iframe.style, {
    width: "100%",
    height: "420px",
    border: "none",
    display: "block",
  });

  panel.appendChild(header);
  panel.appendChild(iframe);
  return panel;
}
