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
    delete process.env.BDS_TARGET;
  });

  afterEach(() => {
    state.ui = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  it("uses the Firefox extension permission window flow and resolves after access is granted", async () => {
    process.env.BDS_TARGET = "firefox";
    const popupWindow = {
      closed: false,
      close: vi.fn(() => {
        popupWindow.closed = true;
      }),
      focus: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(popupWindow);
    chrome.runtime.sendMessage.mockReset();

    const ui = mountUi();
    const permissionPromise = ui.requestWebFetchPermission({
      url: "https://example.com/article",
      origin: "https://example.com",
    });
    await flushUi();

    document.querySelector(".bds-permission-btn-primary").click();
    await flushUi();

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining(
        "static/web-fetch-permission.html?url=https%3A%2F%2Fexample.com%2Farticle",
      ),
      "bds-web-fetch-permission",
      expect.stringContaining("popup=yes"),
    );
    expect(document.querySelector(".bds-permission-info").textContent).toContain(
      "permission window was opened",
    );
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

    const helperUrl = new URL(window.open.mock.calls[0][0]);
    const requestId = helperUrl.searchParams.get("requestId");
    expect(helperUrl.searchParams.get("returnOrigin")).toBe("http://localhost:3000");
    expect(requestId).toBeTruthy();

    window.dispatchEvent(new MessageEvent("message", {
      data: {
        type: "bds:web-fetch-permission-result",
        requestId: "wrong-request",
        granted: true,
      },
    }));
    await flushUi();
    expect(document.querySelector(".bds-permission-modal")).not.toBeNull();

    window.dispatchEvent(new MessageEvent("message", {
      data: {
        type: "bds:web-fetch-permission-result",
        requestId,
        granted: true,
      },
    }));
    await flushUi();

    await expect(permissionPromise).resolves.toBe(true);
    expect(popupWindow.close).toHaveBeenCalledOnce();
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

  it("rechecks granted Firefox permissions on focus if the helper window closes without posting back", async () => {
    process.env.BDS_TARGET = "firefox";
    const popupWindow = {
      closed: false,
      close: vi.fn(() => {
        popupWindow.closed = true;
      }),
      focus: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(popupWindow);
    chrome.runtime.sendMessage.mockResolvedValueOnce({
      ok: true,
      granted: true,
    });

    const ui = mountUi();
    const permissionPromise = ui.requestWebFetchPermission({
      url: "https://example.com/article",
      origin: "https://example.com",
    });
    await flushUi();

    document.querySelector(".bds-permission-btn-primary").click();
    await flushUi();

    popupWindow.closed = true;
    window.dispatchEvent(new Event("focus"));
    await flushUi();

    await expect(permissionPromise).resolves.toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "bds-ensure-host-permission",
      url: "https://example.com/article",
      interactive: false,
    });
  });
});
