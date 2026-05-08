import { fetchTranscript } from "youtube-transcript";
import {
  DEFAULT_GITHUB_COMMIT_COUNT,
  GITHUB_COMMITS_PAGE_SIZE,
  normalizeGitHubCommitCount,
} from "../lib/github-commits.js";

export {
  DEFAULT_GITHUB_COMMIT_COUNT,
  GITHUB_COMMITS_PAGE_SIZE,
};

const WEB_FETCH_PERMISSION_REGISTER_MESSAGE_TYPE =
  "bds-register-web-fetch-permission-request";
const WEB_FETCH_PERMISSION_COMPLETE_MESSAGE_TYPE =
  "bds-complete-web-fetch-permission-request";
const WEB_FETCH_PERMISSION_RELAY_MESSAGE_TYPE =
  "bds-web-fetch-permission-request-complete";

const pendingWebFetchPermissionRequests = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === "bds-get-youtube-transcript") {
    fetchTranscript(message.videoId)
      .then((transcript) => {
        sendResponse({ ok: true, transcript });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: String(error && error.message ? error.message : error),
        });
      });
    return true;
  }

  if (message.type === "bds-fetch-github-zip") {
    fetchGithubZip(message.url, message.token)
      .then((base64) => {
        sendResponse({ ok: true, base64 });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: String(error && error.message ? error.message : error),
          status:
            error && Number.isFinite(error.status) ? Number(error.status) : null,
          authRejected: Boolean(error && error.authRejected),
        });
      });
    return true;
  }

  if (message.type === "bds-fetch-github-commits") {
    fetchGithubCommits(
      message.owner,
      message.repo,
      message.branch,
      message.count,
      message.token,
    )
      .then((commits) => {
        sendResponse({ ok: true, commits });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: String(error && error.message ? error.message : error),
          status:
            error && Number.isFinite(error.status) ? Number(error.status) : null,
          authRejected: Boolean(error && error.authRejected),
          rateLimited: Boolean(error && error.rateLimited),
        });
      });
    return true;
  }

  if (message.type === "bds-fetch-url") {
    fetchPageContent(message.url, message.options)
      .then((html) => {
        sendResponse({ ok: true, html });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: String(error && error.message ? error.message : error),
        });
      });
    return true;
  }

  if (message.type === "bds-ensure-host-permission") {
    ensureHostPermission(message.url, Boolean(message.interactive))
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: String(error && error.message ? error.message : error),
        });
      });
    return true;
  }

  if (message.type === WEB_FETCH_PERMISSION_REGISTER_MESSAGE_TYPE) {
    registerWebFetchPermissionRequest(message.requestId, sender, message.url);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === WEB_FETCH_PERMISSION_COMPLETE_MESSAGE_TYPE) {
    completeWebFetchPermissionRequest(message.requestId, {
      granted: Boolean(message.granted),
      error: String(message.error || "").trim(),
      origin: String(message.origin || "").trim(),
    })
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: String(error && error.message ? error.message : error),
        });
      });
    return true;
  }

  return false;
});



function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + chunkSize, bytes.length)
    );
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function createGithubFetchError(message, options = {}) {
  const error = new Error(message);
  if (Number.isFinite(options.status)) {
    error.status = Number(options.status);
  }
  if (options.authRejected) {
    error.authRejected = true;
  }
  if (options.rateLimited) {
    error.rateLimited = true;
  }
  return error;
}

function sendRuntimeMessageToTab(tabId, message) {
  const tabsApi = chrome && chrome.tabs ? chrome.tabs : null;
  if (!tabsApi || typeof tabsApi.sendMessage !== "function") {
    return Promise.resolve(false);
  }

  return new Promise((resolve, reject) => {
    try {
      tabsApi.sendMessage(tabId, message, () => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(true);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function registerWebFetchPermissionRequest(requestId, sender, url) {
  const safeRequestId = String(requestId || "").trim();
  const tabId = sender && sender.tab && Number.isFinite(sender.tab.id)
    ? Number(sender.tab.id)
    : null;

  if (!safeRequestId || tabId === null) {
    return false;
  }

  pendingWebFetchPermissionRequests.set(safeRequestId, {
    tabId,
    url: String(url || "").trim(),
    createdAt: Date.now(),
  });
  return true;
}

export async function completeWebFetchPermissionRequest(requestId, payload = {}) {
  const safeRequestId = String(requestId || "").trim();
  const request = pendingWebFetchPermissionRequests.get(safeRequestId);
  if (!request) {
    return { ok: false, missingRequest: true };
  }

  pendingWebFetchPermissionRequests.delete(safeRequestId);

  await sendRuntimeMessageToTab(request.tabId, {
    type: WEB_FETCH_PERMISSION_RELAY_MESSAGE_TYPE,
    requestId: safeRequestId,
    granted: Boolean(payload.granted),
    error: String(payload.error || "").trim(),
    origin: String(payload.origin || "").trim(),
    url: request.url,
  });

  return { ok: true, tabId: request.tabId };
}

function buildOriginPermissionPattern(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are supported.");
  }
  return `${parsed.protocol}//${parsed.host}/*`;
}

function callChromePermissions(methodName, payload) {
  const api = chrome && chrome.permissions ? chrome.permissions : null;
  const method = api && typeof api[methodName] === "function"
    ? api[methodName].bind(api)
    : null;

  if (!method) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      const runtimeError = chrome.runtime && chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(value);
    };

    try {
      const maybePromise = method.length >= 2
        ? method(payload, done)
        : method(payload);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(done, reject);
      } else if (method.length < 2) {
        done(maybePromise);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export async function ensureHostPermission(url, interactive = false) {
  const originPattern = buildOriginPermissionPattern(url);
  const hasPermissionsApi = Boolean(
    chrome &&
    chrome.permissions &&
    typeof chrome.permissions.contains === "function"
  );

  if (!hasPermissionsApi) {
    return {
      ok: true,
      granted: true,
      originPattern,
      unsupported: true,
    };
  }

  if (interactive && typeof chrome.permissions.request === "function") {
    try {
      const granted = Boolean(
        await callChromePermissions("request", { origins: [originPattern] })
      );

      if (granted) {
        return {
          ok: true,
          granted: true,
          requested: true,
          originPattern,
        };
      }

      const alreadyGranted = Boolean(
        await callChromePermissions("contains", { origins: [originPattern] })
      );
      if (alreadyGranted) {
        return {
          ok: true,
          granted: true,
          originPattern,
        };
      }

      return {
        ok: false,
        permissionRequired: true,
        denied: true,
        originPattern,
      };
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      if (/\buser (action|gesture)\b|input handler/i.test(message)) {
        return {
          ok: false,
          permissionRequired: true,
          promptUnavailable: true,
          originPattern,
          error: message,
        };
      }
      throw error;
    }
  }

  const alreadyGranted = Boolean(
    await callChromePermissions("contains", { origins: [originPattern] })
  );
  if (alreadyGranted) {
    return {
      ok: true,
      granted: true,
      originPattern,
    };
  }

  return {
    ok: false,
    permissionRequired: true,
    originPattern,
    promptUnavailable: !interactive,
  };
}

export function normalizeGithubCommitCount(count) {
  return normalizeGitHubCommitCount(count);
}

function buildGithubApiHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
  };
  const trimmedToken = String(token || "").trim();
  if (trimmedToken) {
    headers.Authorization = `token ${trimmedToken}`;
  }
  return headers;
}

function buildGithubCommitsUrl(owner, repo, branch, perPage, page) {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
  url.searchParams.set("sha", branch);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  return url.toString();
}

function isGithubRateLimitResponse(resp, bodyText) {
  const remaining = Number.parseInt(
    String(resp.headers.get("x-ratelimit-remaining") || ""),
    10,
  );
  return (
    (resp.status === 403 || resp.status === 429) &&
    (
      remaining === 0 ||
      String(bodyText || "").toLowerCase().includes("api rate limit exceeded")
    )
  );
}

function normalizeGithubCommit(commit) {
  const commitData = commit && commit.commit ? commit.commit : {};
  const authorData = commitData.author || commitData.committer || {};
  const sha = String(commit && commit.sha ? commit.sha : "").trim();
  const author = String(authorData.name || "").trim() || "Unknown author";
  const date = String(authorData.date || "").trim() || "unknown date";
  const message = String(commitData.message || "").trim() || "(no message)";

  return {
    sha: sha ? sha.slice(0, 7) : "unknown",
    author,
    date,
    message,
  };
}

function canSendGithubToken(url) {
  try {
    return new URL(url).hostname === "codeload.github.com";
  } catch {
    return false;
  }
}

async function readZipResponse(resp, url) {
  if (!resp.ok) {
    throw createGithubFetchError(`GitHub returned ${resp.status} for ${url}`, {
      status: resp.status,
    });
  }

  const arrayBuffer = await resp.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength < 100) {
    throw new Error("Received empty or invalid ZIP.");
  }

  const bytes = new Uint8Array(arrayBuffer);
  return bytesToBase64(bytes);
}

async function fetchGithubZip(url, token) {
  if (!url) throw new Error("No URL provided.");

  const trimmedToken = String(token || "").trim();
  const shouldUseToken = Boolean(trimmedToken) && canSendGithubToken(url);

  if (shouldUseToken) {
    let authResponse = null;

    try {
      authResponse = await fetch(url, {
        headers: {
          Authorization: `token ${trimmedToken}`,
        },
      });

      if (authResponse.ok) {
        return await readZipResponse(authResponse, url);
      }

      if (authResponse.status === 401 || authResponse.status === 403) {
        throw createGithubFetchError(
          `GitHub rejected the supplied token for ${url}`,
          {
            status: authResponse.status,
            authRejected: true,
          }
        );
      }
    } catch (error) {
      if (error && error.authRejected) {
        throw error;
      }
      authResponse = null;
    }

    const fallbackResponse = await fetch(url);
    if (fallbackResponse.ok) {
      return await readZipResponse(fallbackResponse, url);
    }

    throw createGithubFetchError(
      `GitHub returned ${fallbackResponse.status} for ${url}`,
      {
        status: fallbackResponse.status,
      }
    );
  }

  return await readZipResponse(await fetch(url), url);
}

export async function fetchGithubCommits(owner, repo, branch, count, token) {
  const safeOwner = String(owner || "").trim();
  const safeRepo = String(repo || "").trim();
  const safeBranch = String(branch || "").trim() || "main";
  const trimmedToken = String(token || "").trim();
  const normalizedCount = normalizeGithubCommitCount(count);

  if (!safeOwner || !safeRepo) {
    throw new Error("Missing GitHub repository.");
  }

  const commits = [];
  let page = 1;

  // GitHub's commits REST endpoint is capped at 100 items per page, so
  // counts above that require pagination even though the UI allows up to 500.
  while (commits.length < normalizedCount) {
    const remaining = normalizedCount - commits.length;
    const perPage = Math.min(GITHUB_COMMITS_PAGE_SIZE, remaining);
    const url = buildGithubCommitsUrl(
      safeOwner,
      safeRepo,
      safeBranch,
      perPage,
      page,
    );
    const resp = await fetch(url, {
      headers: buildGithubApiHeaders(trimmedToken),
    });

    if (!resp.ok) {
      const bodyText = await resp.text();

      if (isGithubRateLimitResponse(resp, bodyText)) {
        throw createGithubFetchError(
          "GitHub API rate limit hit. Add a token for more requests.",
          {
            status: resp.status,
            rateLimited: true,
          }
        );
      }

      if (trimmedToken && (resp.status === 401 || resp.status === 403)) {
        throw createGithubFetchError(
          `GitHub rejected the supplied token for ${safeOwner}/${safeRepo}`,
          {
            status: resp.status,
            authRejected: true,
          }
        );
      }

      if (resp.status === 404) {
        throw createGithubFetchError(
          "Repository not found or you may need a GitHub token for private repos. Add one in Advanced Settings.",
          {
            status: resp.status,
          }
        );
      }

      throw createGithubFetchError(
        `GitHub returned ${resp.status} ${resp.statusText}`.trim(),
        {
          status: resp.status,
        }
      );
    }

    const data = await resp.json();
    if (!Array.isArray(data)) {
      throw new Error("Unexpected GitHub commits response.");
    }

    for (const item of data) {
      if (commits.length >= normalizedCount) {
        break;
      }
      commits.push(normalizeGithubCommit(item));
    }

    if (data.length < perPage) {
      break;
    }

    page += 1;
  }

  return commits;
}

async function fetchPageContent(url, options = {}) {
  if (!url) throw new Error("No URL provided.");

  const fetchOptions = {
    method: options.method || 'GET',
    headers: options.headers || {},
  };

  if (options.body) {
    fetchOptions.body = options.body;
  }

  const resp = await fetch(url, fetchOptions);
  if (!resp.ok) {
    throw new Error(`Server returned ${resp.status} for ${url}`);
  }

  return await resp.text();
}

// Update detection for "What's New" popup
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "update") {
    chrome.storage.local.set({ bds_whats_new_pending: true });
  }
});
