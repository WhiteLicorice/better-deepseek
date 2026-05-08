const SEND_ICON_PATHS = [
  'svg path[d*="M8.3125"]',
  'svg path[d*="M13.12 19.98"]',
];

const EDITOR_SELECTORS = [
  "textarea#chat-input",
  ".ds-textarea textarea",
  'textarea[placeholder]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
];

function getButtonSignature(button) {
  return [
    button.getAttribute("aria-label"),
    button.getAttribute("title"),
    button.getAttribute("data-testid"),
    button.getAttribute("name"),
    button.id,
    button.className,
    button.textContent,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isInsideExtensionUi(button) {
  return Boolean(button.closest("#bds-root")) || button.classList.contains("bds-plus-btn");
}

function findComposerRoot(editor) {
  if (!editor) {
    return null;
  }

  return (
    editor.closest("form") ||
    editor.closest(".ds-textarea") ||
    editor.closest('[class*="textarea"]') ||
    editor.closest('[class*="input"]') ||
    editor.closest('[class*="composer"]') ||
    editor.parentElement
  );
}

function isSendIconButton(button) {
  if (button.querySelector(".ds-icon-send")) {
    return true;
  }

  return SEND_ICON_PATHS.some((selector) => button.querySelector(selector));
}

function dispatchKeyboardEvent(target, type) {
  return target.dispatchEvent(
    new KeyboardEvent(type, {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      charCode: 13,
      bubbles: true,
      cancelable: true,
    }),
  );
}

export function findChatEditor() {
  for (const selector of EDITOR_SELECTORS) {
    const editor = document.querySelector(selector);
    if (editor) {
      return editor;
    }
  }

  return null;
}

export function readChatEditorText(editor) {
  if (!editor) {
    return "";
  }

  const tagName = String(editor.tagName || "").toLowerCase();
  if (tagName === "textarea" || tagName === "input") {
    return String(editor.value || "");
  }

  if (editor.isContentEditable) {
    return String(editor.innerText || editor.textContent || "");
  }

  return String(editor.textContent || "");
}

export function writeTextToChatEditor(text, editor = findChatEditor()) {
  if (!editor) {
    return null;
  }

  const value = String(text || "");
  const tagName = String(editor.tagName || "").toLowerCase();

  if (tagName === "textarea" || tagName === "input") {
    editor.value = value;
  } else if (editor.isContentEditable) {
    editor.textContent = value;
    if ("innerText" in editor) {
      editor.innerText = value;
    }
  } else {
    editor.textContent = value;
  }

  editor.dispatchEvent(new Event("input", { bubbles: true }));
  return editor;
}

export function isButtonDisabled(button) {
  return (
    button.getAttribute("aria-disabled") === "true" ||
    button.classList.contains("ds-icon-button--disabled") ||
    button.hasAttribute("disabled")
  );
}

export function findSendButton(editor = findChatEditor()) {
  const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
  const composerRoot = findComposerRoot(editor);
  let bestMatch = null;
  let bestScore = 0;

  for (const button of buttons) {
    if (!(button instanceof HTMLElement) || isInsideExtensionUi(button)) {
      continue;
    }

    const signature = getButtonSignature(button);
    const hasSubmitType = button.matches('button[type="submit"], [type="submit"]');
    const hasLabelSignal =
      signature.includes("send") || signature.includes("submit");
    const hasIconSignal = isSendIconButton(button);
    const hasStrongSignal = hasSubmitType || hasLabelSignal || hasIconSignal;

    if (!hasStrongSignal) {
      continue;
    }

    let score = 0;

    if (hasSubmitType) {
      score += 8;
    }
    if (hasLabelSignal) {
      score += 6;
    }
    if (hasIconSignal) {
      score += 5;
    }
    if (composerRoot && composerRoot.contains(button)) {
      score += 2;
    }
    if (!isButtonDisabled(button)) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = button;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

export function dispatchEnterToChatEditor(editor = findChatEditor()) {
  if (!editor) {
    return false;
  }

  if (typeof editor.focus === "function") {
    editor.focus();
  }

  dispatchKeyboardEvent(editor, "keydown");
  dispatchKeyboardEvent(editor, "keypress");
  dispatchKeyboardEvent(editor, "keyup");
  return true;
}

export function robustSend(options = {}) {
  const {
    editor = findChatEditor(),
    initialDelayMs = 500,
    intervalMs = 200,
    maxAttempts = 50,
    enterFallbackAttempt = 15,
    logPrefix = "[BDS]",
    onFailure = null,
    onSuccess = null,
  } = options;

  let attempts = 0;
  let enterAttempted = false;
  const initialText = readChatEditorText(editor);

  const attemptSend = () => {
    attempts += 1;

    const sendButton = findSendButton(editor);
    if (sendButton && !isButtonDisabled(sendButton)) {
      sendButton.click();
      console.log(`${logPrefix} Sent successfully after ${attempts} attempts.`);
      onSuccess?.({ method: "button", attempts });
      return;
    }

    if (!enterAttempted && attempts >= enterFallbackAttempt) {
      enterAttempted = dispatchEnterToChatEditor(editor);
      if (enterAttempted) {
        console.log(`${logPrefix} Attempted Enter-key send fallback.`);
      }
    }

    if (enterAttempted && initialText && !readChatEditorText(editor).trim()) {
      console.log(`${logPrefix} Send completed after Enter-key fallback.`);
      onSuccess?.({ method: "enter", attempts });
      return;
    }

    if (attempts < maxAttempts) {
      setTimeout(attemptSend, intervalMs);
      return;
    }

    console.error(`${logPrefix} Failed to send - timeout.`);
    onFailure?.({ attempts, usedEnterFallback: enterAttempted });
  };

  setTimeout(attemptSend, initialDelayMs);
}
