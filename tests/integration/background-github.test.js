import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("youtube-transcript", () => ({
  fetchTranscript: vi.fn(),
}));

import {
  completeWebFetchPermissionRequest,
  ensureHostPermission,
  fetchGithubCommits,
  normalizeGithubCommitCount,
  registerWebFetchPermissionRequest,
} from "../../src/background/index.js";

function createJsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });
}

describe("background GitHub commits fetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
    chrome.permissions.contains.mockReset();
    chrome.permissions.request.mockReset();
    chrome.tabs.sendMessage.mockReset();
    chrome.permissions.contains.mockResolvedValue(true);
    chrome.permissions.request.mockResolvedValue(true);
    chrome.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
      callback?.();
    });
  });

  it("paginates commit history and returns structured commit data", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      sha: `abcdef${String(index).padStart(34, "0")}`,
      commit: {
        author: {
          name: `Author ${index}`,
          date: `2026-05-${String((index % 9) + 1).padStart(2, "0")}T10:00:00Z`,
        },
        message: `Commit ${index}`,
      },
    }));
    const secondPage = Array.from({ length: 20 }, (_, index) => ({
      sha: `fedcba${String(index).padStart(34, "0")}`,
      commit: {
        author: {
          name: `Tail ${index}`,
          date: `2026-05-${String((index % 9) + 1).padStart(2, "0")}T12:00:00Z`,
        },
        message: `Tail commit ${index}`,
      },
    }));

    fetch
      .mockResolvedValueOnce(createJsonResponse(firstPage))
      .mockResolvedValueOnce(createJsonResponse(secondPage));

    const commits = await fetchGithubCommits(
      "owner",
      "repo",
      "feature/test",
      120,
      "ghp_secret",
    );

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toContain("per_page=100");
    expect(fetch.mock.calls[0][0]).toContain("page=1");
    expect(fetch.mock.calls[0][0]).toContain("sha=feature%2Ftest");
    expect(fetch.mock.calls[1][0]).toContain("per_page=20");
    expect(fetch.mock.calls[1][0]).toContain("page=2");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("token ghp_secret");
    expect(fetch.mock.calls[0][1].headers.Accept).toBe("application/vnd.github+json");
    expect(fetch.mock.calls[0][1].headers["X-GitHub-Api-Version"]).toBeUndefined();
    expect(commits).toHaveLength(120);
    expect(commits[0]).toEqual({
      sha: "abcdef0",
      author: "Author 0",
      date: "2026-05-01T10:00:00Z",
      message: "Commit 0",
    });
    expect(commits[119]).toEqual({
      sha: "fedcba0",
      author: "Tail 19",
      date: "2026-05-02T12:00:00Z",
      message: "Tail commit 19",
    });
  });

  it("marks rejected-token responses as auth failures", async () => {
    fetch.mockResolvedValue(
      new Response("{}", {
        status: 401,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    await expect(
      fetchGithubCommits("owner", "repo", "main", 10, "ghp_secret"),
    ).rejects.toMatchObject({
      status: 401,
      authRejected: true,
    });
  });

  it("normalizes background commit counts to the supported range", () => {
    expect(normalizeGithubCommitCount(0)).toBe(1);
    expect(normalizeGithubCommitCount(600)).toBe(600);
  });

  it("requests optional host permission when broad site access is needed", async () => {
    chrome.permissions.request.mockResolvedValue(true);

    const result = await ensureHostPermission("https://example.com/a", true);

    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ["https://example.com/*"],
    });
    expect(chrome.permissions.contains).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      granted: true,
      requested: true,
      originPattern: "https://example.com/*",
    });
  });

  it("reports prompt-unavailable when the browser rejects permission requests without user input", async () => {
    chrome.permissions.request.mockRejectedValue(
      new Error("permissions.request may only be called from a user input handler"),
    );

    const result = await ensureHostPermission("https://example.com/a", true);

    expect(result).toMatchObject({
      ok: false,
      permissionRequired: true,
      promptUnavailable: true,
      originPattern: "https://example.com/*",
    });
    expect(result.error).toContain("user input handler");
  });

  it("uses contains-only checks for non-interactive permission probes", async () => {
    chrome.permissions.contains.mockResolvedValue(false);

    const result = await ensureHostPermission("https://example.com/a", false);

    expect(chrome.permissions.contains).toHaveBeenCalledWith({
      origins: ["https://example.com/*"],
    });
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      permissionRequired: true,
      promptUnavailable: true,
      originPattern: "https://example.com/*",
    });
  });

  it("relays completed Firefox web-fetch permission requests back to the originating tab", async () => {
    const registered = registerWebFetchPermissionRequest(
      "req-1",
      { tab: { id: 321 } },
      "https://example.com/article",
    );

    const result = await completeWebFetchPermissionRequest("req-1", {
      granted: true,
      origin: "https://example.com",
    });

    expect(registered).toBe(true);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      321,
      {
        type: "bds-web-fetch-permission-request-complete",
        requestId: "req-1",
        granted: true,
        error: "",
        origin: "https://example.com",
        url: "https://example.com/article",
      },
      expect.any(Function),
    );
    expect(result).toMatchObject({
      ok: true,
      tabId: 321,
    });
  });
});
