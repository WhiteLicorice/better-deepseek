// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findChatEditor,
  findSendButton,
  isButtonDisabled,
  robustSend,
  writeTextToChatEditor,
} from "../../src/content/chat-send.js";

describe("chat-send integration", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  it("finds the chat editor and prefers a send button over extension buttons", () => {
    document.body.innerHTML = `
      <div id="bds-root">
        <button class="bds-plus-btn" aria-label="Send"></button>
      </div>
      <div class="ds-textarea">
        <textarea id="chat-input"></textarea>
      </div>
      <button type="submit" aria-label="Send"></button>
    `;

    const editor = findChatEditor();
    const sendButton = findSendButton(editor);

    expect(editor).toBe(document.querySelector("#chat-input"));
    expect(sendButton).toBe(document.querySelector('button[type="submit"]'));
  });

  it("detects disabled send buttons", () => {
    document.body.innerHTML = '<button aria-disabled="true"></button>';
    expect(isButtonDisabled(document.querySelector("button"))).toBe(true);
  });

  it("falls back to Enter when no send button can be detected", async () => {
    document.body.innerHTML = `
      <textarea id="chat-input"></textarea>
      <button type="button"></button>
    `;

    const editor = document.querySelector("#chat-input");
    writeTextToChatEditor("auto message", editor);
    const enterHandler = vi.fn(() => {
      editor.value = "";
    });
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        enterHandler();
      }
    });

    const onSuccess = vi.fn();
    robustSend({
      editor,
      initialDelayMs: 0,
      intervalMs: 1,
      enterFallbackAttempt: 2,
      maxAttempts: 4,
      onSuccess,
    });

    await vi.advanceTimersByTimeAsync(5);

    expect(enterHandler).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith({
      method: "enter",
      attempts: 2,
    });
  });
});
