// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushUi } from "../../helpers/svelte.js";
import { mountUi } from "../../../src/content/ui/mount.js";
import state from "../../../src/content/state.js";
import { resetAppState } from "../../helpers/app-state.js";

describe("App integration", () => {
  beforeEach(() => {
    resetAppState();
    document.body.innerHTML = "";
    chrome.runtime.sendMessage.mockReset();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 0));
  });

  afterEach(() => {
    state.ui = null;
    vi.unstubAllGlobals();
    document.getElementById("bds-root")?.remove();
  });

  it("shows the web fetch permission modal and requests access from its confirm button", async () => {
    chrome.runtime.sendMessage.mockResolvedValueOnce({
      ok: true,
      granted: true,
      requested: true,
    });
    const ui = mountUi();

    const permissionPromise = ui.requestWebFetchPermission({
      url: "https://example.com/article",
      origin: "https://example.com",
      message:
        "Better DeepSeek needs permission to access https://example.com before Web Fetch can continue.",
    });
    await flushUi();

    expect(document.querySelector(".bds-permission-modal")).not.toBeNull();
    expect(document.querySelector(".bds-permission-copy").textContent).toContain(
      "Better DeepSeek needs permission",
    );

    document.querySelector(".bds-permission-btn-primary").click();
    await flushUi();

    await expect(permissionPromise).resolves.toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "bds-ensure-host-permission",
      url: "https://example.com/article",
      interactive: true,
    });
    expect(document.querySelector(".bds-permission-modal")).toBeNull();
  });

  it("keeps the modal open with fallback guidance when the browser cannot show its own prompt", async () => {
    chrome.runtime.sendMessage.mockResolvedValueOnce({
      ok: false,
      permissionRequired: true,
      promptUnavailable: true,
    });
    const ui = mountUi();

    const permissionPromise = ui.requestWebFetchPermission({
      url: "https://example.com/article",
      origin: "https://example.com",
    });
    await flushUi();

    document.querySelector(".bds-permission-btn-primary").click();
    await flushUi();

    expect(document.querySelector(".bds-permission-error").textContent).toContain(
      "could not show the permission prompt",
    );
    expect(document.querySelector(".bds-permission-modal")).not.toBeNull();

    document.querySelector(".bds-permission-btn-secondary").click();
    await flushUi();

    await expect(permissionPromise).resolves.toBe(false);
  });
});
