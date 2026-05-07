// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { fetchAndConvertWebPage } from "../../src/content/files/web-reader.js";

async function readFileText(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
}

describe("web-reader integration", () => {
  beforeEach(() => {
    chrome.runtime.sendMessage.mockReset();
  });

  it("requests host permission before fetching page content", async () => {
    chrome.runtime.sendMessage
      .mockResolvedValueOnce({ ok: true, granted: true })
      .mockResolvedValueOnce({
        ok: true,
        html: `
          <html>
            <head><title>Example Title</title></head>
            <body><main><h1>Example Title</h1><p>Hello world.</p></main></body>
          </html>
        `,
      });

    const file = await fetchAndConvertWebPage("https://example.com/article");
    const text = await readFileText(file);

    expect(chrome.runtime.sendMessage.mock.calls[0][0]).toEqual({
      type: "bds-ensure-host-permission",
      url: "https://example.com/article",
      interactive: true,
    });
    expect(chrome.runtime.sendMessage.mock.calls[1][0]).toEqual({
      type: "bds-fetch-url",
      url: "https://example.com/article",
    });
    expect(text).toContain("Title: Example Title");
    expect(text).toContain("Hello world.");
  });

  it("surfaces a clear permission error when site access is denied", async () => {
    chrome.runtime.sendMessage.mockResolvedValueOnce({
      ok: false,
      denied: true,
    });

    await expect(
      fetchAndConvertWebPage("https://example.com/private"),
    ).rejects.toThrow("permission was denied");
  });

  it("explains when automatic web fetch cannot request permission itself", async () => {
    chrome.runtime.sendMessage.mockResolvedValueOnce({
      ok: false,
      permissionRequired: true,
      promptUnavailable: true,
    });

    let error = null;
    try {
      await fetchAndConvertWebPage(
        "https://example.com/private",
        () => {},
        { interactive: false },
      );
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(Error);
    expect(error.permissionRequired).toBe(true);
    expect(error.promptUnavailable).toBe(true);
    expect(error.bdsWebFetchPermissionError).toBe(true);
    expect(error.message).toContain(
      "Automatic Web Fetch cannot ask for that permission by itself",
    );
  });

  it("explains when the browser cannot show the permission prompt from the page", async () => {
    chrome.runtime.sendMessage.mockResolvedValueOnce({
      ok: false,
      permissionRequired: true,
      promptUnavailable: true,
    });

    let error = null;
    try {
      await fetchAndConvertWebPage("https://example.com/private");
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(Error);
    expect(error.permissionRequired).toBe(true);
    expect(error.promptUnavailable).toBe(true);
    expect(error.bdsWebFetchPermissionError).toBe(true);
    expect(error.message).toContain(
      "could not show the permission prompt from the chat page",
    );
  });
});
