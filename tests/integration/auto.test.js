// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppState } from "../helpers/app-state.js";

const readerMocks = vi.hoisted(() => ({
  fetchAndConvertWebPage: vi.fn(),
  isWebFetchPermissionError: vi.fn((error) =>
    Boolean(error && error.bdsWebFetchPermissionError),
  ),
  fetchGitHubRepo: vi.fn(),
  fetchTwitterTweet: vi.fn(),
  fetchYouTubeData: vi.fn(),
}));

vi.mock("../../src/content/files/web-reader.js", () => ({
  fetchAndConvertWebPage: readerMocks.fetchAndConvertWebPage,
  isWebFetchPermissionError: readerMocks.isWebFetchPermissionError,
}));
vi.mock("../../src/content/files/github-reader.js", () => ({
  fetchGitHubRepo: readerMocks.fetchGitHubRepo,
}));
vi.mock("../../src/content/files/twitter-reader.js", () => ({
  fetchTwitterTweet: readerMocks.fetchTwitterTweet,
}));
vi.mock("../../src/content/files/youtube-reader.js", () => ({
  fetchYouTubeData: readerMocks.fetchYouTubeData,
}));

function setupAutoDom() {
  document.body.innerHTML = `
    <input type="file" multiple />
    <textarea id="chat-input"></textarea>
    <button aria-label="Send"></button>
  `;

  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", {
    configurable: true,
    writable: true,
    value: [],
  });

  const sendButton = document.querySelector("button");
  sendButton.click = vi.fn();
}

async function importAutoModule() {
  vi.resetModules();
  return await import("../../src/content/auto.js");
}

describe("auto integration", () => {
  beforeEach(() => {
    resetAppState();
    setupAutoDom();
    vi.useFakeTimers();
    Object.values(readerMocks).forEach((mock) => mock.mockReset());
    readerMocks.isWebFetchPermissionError.mockImplementation((error) =>
      Boolean(error && error.bdsWebFetchPermissionError),
    );
  });

  it("fetches a web page and injects the returned file once", async () => {
    const file = new File(["page"], "page.txt", { type: "text/plain" });
    readerMocks.fetchAndConvertWebPage.mockResolvedValue(file);
    const { handleAutoWebFetch } = await importAutoModule();

    await handleAutoWebFetch("https://example.com");
    await vi.advanceTimersByTimeAsync(600);

    const input = document.querySelector('input[type="file"]');
    const editor = document.querySelector("#chat-input");
    const sendButton = document.querySelector("button");

    expect(readerMocks.fetchAndConvertWebPage).toHaveBeenCalledOnce();
    expect(readerMocks.fetchAndConvertWebPage).toHaveBeenCalledWith(
      "https://example.com",
      expect.any(Function),
      { interactive: false },
    );
    expect(input.files).toHaveLength(1);
    expect(editor.value).toContain("Web Fetch Result");
    expect(sendButton.click).toHaveBeenCalledOnce();
  });

  it("creates an error attachment when github fetch fails", async () => {
    readerMocks.fetchGitHubRepo.mockRejectedValue(new Error("boom"));
    const { handleAutoGitHubFetch } = await importAutoModule();
    const freshState = (await import("../../src/content/state.js")).default;
    freshState.settings.githubToken = "ghp_secret";

    await handleAutoGitHubFetch("owner/repo");
    await vi.advanceTimersByTimeAsync(600);

    const input = document.querySelector('input[type="file"]');
    expect(readerMocks.fetchGitHubRepo).toHaveBeenCalledWith(
      "owner/repo",
      expect.any(Function),
      { token: "ghp_secret" },
    );
    expect(input.files[0].name).toContain("github_error_owner_repo");
  });

  it("opens the permission dialog instead of sending a permission failure into chat", async () => {
    const error = Object.assign(
      new Error(
        "Web Fetch needs permission to access https://example.com. Automatic Web Fetch cannot ask for that permission by itself.",
      ),
      {
        bdsWebFetchPermissionError: true,
        origin: "https://example.com",
      },
    );
    readerMocks.fetchAndConvertWebPage.mockRejectedValue(error);
    const { handleAutoWebFetch } = await importAutoModule();
    const freshState = (await import("../../src/content/state.js")).default;
    freshState.ui = {
      showToast: vi.fn(),
      requestWebFetchPermission: vi.fn(async () => false),
    };

    await handleAutoWebFetch("https://example.com");
    await vi.advanceTimersByTimeAsync(600);

    expect(readerMocks.isWebFetchPermissionError).toHaveBeenCalledWith(error);
    expect(freshState.ui.requestWebFetchPermission).toHaveBeenCalledWith({
      url: "https://example.com",
      origin: "https://example.com",
      message:
        "Better DeepSeek needs permission to access https://example.com before Web Fetch can continue.",
    });
    expect(freshState.ui.showToast).not.toHaveBeenCalled();
    expect(document.querySelector('input[type="file"]').files).toHaveLength(0);
    expect(document.querySelector("button").click).not.toHaveBeenCalled();
  });

  it("retries automatic web fetch after the permission dialog grants access", async () => {
    const permissionError = Object.assign(
      new Error(
        "Web Fetch needs permission to access https://example.com. Automatic Web Fetch cannot ask for that permission by itself.",
      ),
      {
        bdsWebFetchPermissionError: true,
        origin: "https://example.com",
      },
    );
    const file = new File(["page"], "page.txt", { type: "text/plain" });
    readerMocks.fetchAndConvertWebPage
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValueOnce(file);
    const { handleAutoWebFetch } = await importAutoModule();
    const freshState = (await import("../../src/content/state.js")).default;
    freshState.ui = {
      showToast: vi.fn(),
      requestWebFetchPermission: vi.fn(async () => true),
    };

    await handleAutoWebFetch("https://example.com");
    await vi.advanceTimersByTimeAsync(600);

    expect(readerMocks.fetchAndConvertWebPage).toHaveBeenCalledTimes(2);
    expect(freshState.ui.requestWebFetchPermission).toHaveBeenCalledTimes(1);
    expect(document.querySelector('input[type="file"]').files).toHaveLength(1);
    expect(document.querySelector('input[type="file"]').files[0].name).toBe("page.txt");
    expect(document.querySelector("button").click).toHaveBeenCalledOnce();
  });

  it("falls back to a toast when the permission dialog API is unavailable", async () => {
    const error = Object.assign(
      new Error(
        "Web Fetch needs permission to access https://example.com. Automatic Web Fetch cannot ask for that permission by itself.",
      ),
      { bdsWebFetchPermissionError: true },
    );
    readerMocks.fetchAndConvertWebPage.mockRejectedValue(error);
    const { handleAutoWebFetch } = await importAutoModule();
    const freshState = (await import("../../src/content/state.js")).default;
    freshState.ui = { showToast: vi.fn() };

    await handleAutoWebFetch("https://example.com");
    await vi.advanceTimersByTimeAsync(600);

    expect(freshState.ui.showToast).toHaveBeenCalledWith(error.message);
    expect(document.querySelector('input[type="file"]').files).toHaveLength(0);
  });

  it("prevents duplicate auto requests for the same url", async () => {
    readerMocks.fetchTwitterTweet.mockResolvedValue(
      new File(["tweet"], "tweet.md", { type: "text/markdown" }),
    );
    const { handleAutoTwitterFetch } = await importAutoModule();

    await handleAutoTwitterFetch("https://x.com/post/1");
    await handleAutoTwitterFetch("https://x.com/post/1");

    expect(readerMocks.fetchTwitterTweet).toHaveBeenCalledOnce();
  });

  it("injects youtube files and triggers send", async () => {
    readerMocks.fetchYouTubeData.mockResolvedValue(
      new File(["video"], "video.txt", { type: "text/plain" }),
    );
    const { handleAutoYouTubeFetch } = await importAutoModule();

    await handleAutoYouTubeFetch("https://youtu.be/demo");
    await vi.advanceTimersByTimeAsync(600);

    expect(document.querySelector('input[type="file"]').files).toHaveLength(1);
    expect(document.querySelector("button").click).toHaveBeenCalledOnce();
  });

  it("falls back to the Enter key when no send button can be identified", async () => {
    setupAutoDom();
    const file = new File(["page"], "page.txt", { type: "text/plain" });
    readerMocks.fetchAndConvertWebPage.mockResolvedValue(file);
    const freshState = (await import("../../src/content/state.js")).default;
    freshState.ui = { showToast: vi.fn() };

    const sendButton = document.querySelector("button");
    sendButton.removeAttribute("aria-label");
    const editor = document.querySelector("#chat-input");
    const enterHandler = vi.fn(() => {
      editor.value = "";
    });
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        enterHandler();
      }
    });

    const { handleAutoWebFetch } = await importAutoModule();
    await handleAutoWebFetch("https://example.com/fallback");
    await vi.advanceTimersByTimeAsync(4000);

    expect(enterHandler).toHaveBeenCalledOnce();
    expect(freshState.ui.showToast).not.toHaveBeenCalled();
  });
});
