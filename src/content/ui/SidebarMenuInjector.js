import { exportSession } from "../tools/exporter.js";
import { setPendingExport, checkPendingExport } from "../tools/pending-export.js";

// Keep track of which chat item's menu was opened
let lastClickedChatUrl = null;

// Markdown Icon (Document-like)
const MD_ICON = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
  <polyline points="14 2 14 8 20 8"></polyline>
  <line x1="16" y1="13" x2="8" y2="13"></line>
  <line x1="16" y1="17" x2="8" y2="17"></line>
  <polyline points="10 9 9 9 8 9"></polyline>
</svg>`;

// PDF Icon
const PDF_ICON = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
  <polyline points="14 2 14 8 20 8"></polyline>
  <path d="M9 15h3a2 2 0 0 0 0-4H9v4Z"></path>
</svg>`;

export function initSidebarMenuInjector() {
  // Capture the chat URL when the menu button is clicked
  document.addEventListener("mousedown", (e) => {
    const btn = e.target.closest("div._2090548");
    if (btn) {
      const chatItem = btn.closest("a._546d736");
      if (chatItem) {
        lastClickedChatUrl = chatItem.href;
      }
    }
  }, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.classList.contains("ds-dropdown-menu")) {
            checkAndInject(node);
          } else {
            const menu = node.querySelector(".ds-dropdown-menu");
            if (menu) checkAndInject(menu);
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial check for pending exports
  checkPendingExport();
}

async function handleExportAction(format) {
  const targetUrl = lastClickedChatUrl;
  if (!targetUrl) return;

  if (window.location.href === targetUrl) {
    exportSession(format);
  } else {
    await setPendingExport(targetUrl, format);
    window.location.href = targetUrl;
  }
}

function checkAndInject(menu) {
  if (menu.querySelector(".bds-export-option")) return;

  const labels = Array.from(
    menu.querySelectorAll(".ds-dropdown-menu-option__label")
  ).map((el) => el.textContent.trim().toLowerCase());

  const isChatMenu =
    labels.includes("rename") ||
    labels.includes("pin") ||
    labels.includes("share") ||
    labels.includes("delete");

  if (isChatMenu) {
    injectOptions(menu);
  }
}

function injectOptions(menu) {
  const deleteOption = Array.from(
    menu.querySelectorAll(".ds-dropdown-menu-option")
  ).find((opt) =>
    opt.querySelector(".ds-dropdown-menu-option__label")?.textContent.toLowerCase().includes("delete")
  );

  const insertBefore = deleteOption || null;

  const mdOption = createMenuOption("Export as Markdown (.md)", MD_ICON, () => {
    handleExportAction("markdown");
  });

  const pdfOption = createMenuOption("Export as PDF Document", PDF_ICON, () => {
    handleExportAction("pdf");
  });

  menu.insertBefore(mdOption, insertBefore);
  menu.insertBefore(pdfOption, insertBefore);
  
  mdOption.style.borderTop = "1px solid rgba(0,0,0,0.05)";
  mdOption.style.marginTop = "4px";
  mdOption.style.paddingTop = "8px";
}

function createMenuOption(label, iconHtml, onClick) {
  const opt = document.createElement("div");
  opt.className = "ds-dropdown-menu-option ds-dropdown-menu-option--none bds-export-option";
  
  opt.innerHTML = `
    <div class="ds-dropdown-menu-option__icon">${iconHtml}</div>
    <div class="ds-dropdown-menu-option__label">${label}</div>
  `;

  opt.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });

  return opt;
}
