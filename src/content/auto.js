/**
 * BDS:AUTO Systems
 * Handles automatic requests from DeepSeek.
 */

import {
  fetchAndConvertWebPage,
  isWebFetchPermissionError,
} from "./files/web-reader.js";
import { fetchGitHubRepo } from "./files/github-reader.js";
import { fetchTwitterTweet } from "./files/twitter-reader.js";
import { fetchYouTubeData } from "./files/youtube-reader.js";
import {
  findChatEditor,
  robustSend,
  writeTextToChatEditor,
} from "./chat-send.js";
import appState from "./state.js";

const activeWebFetches = new Set();
const activeGitHubFetches = new Set();
const activeTwitterFetches = new Set();
const activeYouTubeFetches = new Set();

const handledWebFetchesThisTurn = new Set();
const handledGitHubFetchesThisTurn = new Set();
const handledTwitterFetchesThisTurn = new Set();
const handledYouTubeFetchesThisTurn = new Set();

const AUTO_REQUEST_CHANNELS = {
  web: {
    active: activeWebFetches,
    handled: handledWebFetchesThisTurn,
    duplicateActiveMessage:
      "Already fetching this page. Waiting for the current Web Fetch to finish.",
    duplicateHandledMessage:
      "Skipping duplicate Web Fetch for this prompt. Send another message to fetch it again.",
  },
  github: {
    active: activeGitHubFetches,
    handled: handledGitHubFetchesThisTurn,
    duplicateActiveMessage:
      "Already fetching this repository. Waiting for the current GitHub fetch to finish.",
    duplicateHandledMessage:
      "Skipping duplicate GitHub fetch for this prompt. Send another message to fetch it again.",
  },
  twitter: {
    active: activeTwitterFetches,
    handled: handledTwitterFetchesThisTurn,
    duplicateActiveMessage:
      "Already fetching this tweet. Waiting for the current Twitter fetch to finish.",
    duplicateHandledMessage:
      "Skipping duplicate Twitter fetch for this prompt. Send another message to fetch it again.",
  },
  youtube: {
    active: activeYouTubeFetches,
    handled: handledYouTubeFetchesThisTurn,
    duplicateActiveMessage:
      "Already fetching this video. Waiting for the current YouTube fetch to finish.",
    duplicateHandledMessage:
      "Skipping duplicate YouTube fetch for this prompt. Send another message to fetch it again.",
  },
};

function showAutoRequestToast(message) {
  if (message && appState.ui?.showToast) {
    appState.ui.showToast(message);
  }
}

function beginAutoRequest(channel, key) {
  if (channel.active.has(key)) {
    showAutoRequestToast(channel.duplicateActiveMessage);
    return false;
  }

  if (channel.handled.has(key)) {
    showAutoRequestToast(channel.duplicateHandledMessage);
    return false;
  }

  channel.active.add(key);
  channel.handled.add(key);
  return true;
}

function releaseAutoRequest(channel, key) {
  channel.active.delete(key);
}

function forgetHandledAutoRequest(channel, key) {
  channel.handled.delete(key);
}

export function resetAutoRequestTurnDedup() {
  for (const channel of Object.values(AUTO_REQUEST_CHANNELS)) {
    channel.handled.clear();
  }
}

export function resetAllAutoRequestState() {
  for (const channel of Object.values(AUTO_REQUEST_CHANNELS)) {
    channel.active.clear();
    channel.handled.clear();
  }
}

function getOriginForUi(url, error) {
  if (error?.origin) {
    return error.origin;
  }

  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export async function handleAutoWebFetch(url) {
  const channel = AUTO_REQUEST_CHANNELS.web;
  if (!beginAutoRequest(channel, url)) {
    return;
  }

  console.log(`[BDS:AUTO] Starting automatic web fetch for: ${url}`);

  try {
    const file = await fetchAndConvertWebPage(url, (status) => {
      console.log(`[BDS:AUTO] Web Fetch Status: ${status}`);
    }, { interactive: false });

    if (file) {
      injectFileAndSend(file, `<BetterDeepSeek>\n[BDS:AUTO] Web Fetch Result for: ${url}\n</BetterDeepSeek>`);
    }
  } catch (err) {
    console.error("[BDS:AUTO] Web Fetch Failed:", err);

    if (isWebFetchPermissionError(err)) {
      const origin = getOriginForUi(url, err);
      const permissionRequest = appState.ui?.requestWebFetchPermission;

      if (typeof permissionRequest === "function") {
        const granted = await permissionRequest({
          url,
          origin,
          message:
            `Better DeepSeek needs permission to access ${origin} before Web Fetch can continue.`,
        });

        if (granted) {
          forgetHandledAutoRequest(channel, url);
          releaseAutoRequest(channel, url);
          return await handleAutoWebFetch(url);
        }

        return;
      }

      if (appState.ui?.showToast) {
        appState.ui.showToast(err.message);
      }
      return;
    }

    // Optionally create a text file with the error so DeepSeek knows it failed
    const errorBlob = new Blob([`Failed to fetch ${url}:\n\n${err.message}`], { type: "text/plain" });
    const errorFile = new File([errorBlob], `error_${url.replace(/[^a-zA-Z0-9]/g, "_")}.txt`, { type: "text/plain" });
    injectFileAndSend(errorFile, `<BetterDeepSeek>\n[BDS:AUTO] Web fetch failed for ${url}\n</BetterDeepSeek>`);
  } finally {
    releaseAutoRequest(channel, url);
  }
}

export async function handleAutoGitHubFetch(repoUrl) {
  const channel = AUTO_REQUEST_CHANNELS.github;
  if (!beginAutoRequest(channel, repoUrl)) {
    return;
  }

  console.log(`[BDS:AUTO] Starting automatic GitHub fetch for: ${repoUrl}`);

  try {
    const token = String(appState.settings.githubToken || "").trim();
    const file = await fetchGitHubRepo(
      repoUrl,
      (status) => {
        console.log(`[BDS:AUTO] GitHub Fetch Status: ${status}`);
      },
      { token }
    );

    if (file) {
      injectFileAndSend(file, `<BetterDeepSeek>\n[BDS:AUTO] GitHub Fetch Result for: ${repoUrl}\n</BetterDeepSeek>`);
    }
  } catch (err) {
    console.error("[BDS:AUTO] GitHub Fetch Failed:", err);
    const errorBlob = new Blob([`Failed to fetch GitHub repo ${repoUrl}:\n\n${err.message}`], { type: "text/plain" });
    const errorFile = new File([errorBlob], `github_error_${repoUrl.replace(/[^a-zA-Z0-9]/g, "_")}.txt`, { type: "text/plain" });
    injectFileAndSend(errorFile, `<BetterDeepSeek>\n[BDS:AUTO] GitHub fetch failed for ${repoUrl}\n</BetterDeepSeek>`);
  } finally {
    releaseAutoRequest(channel, repoUrl);
  }
}

export async function handleAutoTwitterFetch(url) {
  const channel = AUTO_REQUEST_CHANNELS.twitter;
  if (!beginAutoRequest(channel, url)) {
    return;
  }

  console.log(`[BDS:AUTO] Starting automatic Twitter fetch for: ${url}`);

  try {
    const file = await fetchTwitterTweet(url);
    if (file) {
      injectFileAndSend(file, `<BetterDeepSeek>\n[BDS:AUTO] Twitter Fetch Result for: ${url}\n</BetterDeepSeek>`);
    }
  } catch (err) {
    console.error("[BDS:AUTO] Twitter Fetch Failed:", err);
    const errorBlob = new Blob([`Failed to fetch tweet ${url}:\n\n${err.message}`], { type: "text/plain" });
    const errorFile = new File([errorBlob], `twitter_error_${url.replace(/[^a-zA-Z0-9]/g, "_")}.md`, { type: "text/plain" });
    injectFileAndSend(errorFile, `<BetterDeepSeek>\n[BDS:AUTO] Twitter fetch failed for ${url}\n</BetterDeepSeek>`);
  } finally {
    releaseAutoRequest(channel, url);
  }
}

export async function handleAutoYouTubeFetch(url) {
  const channel = AUTO_REQUEST_CHANNELS.youtube;
  if (!beginAutoRequest(channel, url)) {
    return;
  }

  console.log(`[BDS:AUTO] Starting automatic YouTube fetch for: ${url}`);

  try {
    const file = await fetchYouTubeData(url);
    if (file) {
      injectFileAndSend(file, `<BetterDeepSeek>\n[BDS:AUTO] YouTube Fetch Result for: ${url}\n</BetterDeepSeek>`);
    }
  } catch (err) {
    console.error("[BDS:AUTO] YouTube Fetch Failed:", err);
    const errorBlob = new Blob([`Failed to fetch YouTube video ${url}:\n\n${err.message}`], { type: "text/plain" });
    const errorFile = new File([errorBlob], `youtube_error_${url.replace(/[^a-zA-Z0-9]/g, "_")}.txt`, { type: "text/plain" });
    injectFileAndSend(errorFile, `<BetterDeepSeek>\n[BDS:AUTO] YouTube fetch failed for ${url}\n</BetterDeepSeek>`);
  } finally {
    releaseAutoRequest(channel, url);
  }
}

/**
 * Handles automatic error reporting when a tool fails in the sandbox.
 * Constructs a correction prompt and sends it to the chat.
 * @param {string} toolName - Name of the tool (e.g., 'PPTX', 'Excel', 'Word')
 * @param {string} error - The error message received from the sandbox
 * @param {string} originalCode - The code that caused the error
 */
export async function handleAutoErrorReport(toolName, error, originalCode) {
  const autoMessage = [
    `<BetterDeepSeek>`,
    `[BDS:AUTO] ERROR during ${toolName} generation.`,
    `Error Message: ${error}`,
    `Original Code Snippet:`,
    "```javascript",
    originalCode.trim(),
    "```",
    `Please analyze the error, fix the code, and provide the corrected version within the appropriate <BDS:${toolName.toLowerCase()}> tag.`,
    `</BetterDeepSeek>`
  ].join("\n");

  console.log(`[BDS:AUTO] Sending error report for ${toolName}...`);

  // We use injectFileAndSend without a file for pure text injection
  injectPureTextAndSend(autoMessage);
}

function injectPureTextAndSend(autoMessage) {
  const editor = writeTextToChatEditor(autoMessage);
  if (!editor) {
    console.error("[BDS:AUTO] Could not find chat editor for text injection.");
    if (appState.ui?.showToast) {
      appState.ui.showToast("Could not find input field - auto-send aborted.");
    }
    return;
  }

  robustSend({
    editor,
    logPrefix: "[BDS:AUTO]",
    onFailure: () => {
      if (appState.ui?.showToast) {
        appState.ui.showToast(
          "Could not send the message automatically - please click Send manually.",
        );
      }
    },
  });
}


function injectFileAndSend(file, autoMessage = "") {
  const nativeInput = document.querySelector('input[type="file"][multiple]');
  if (!nativeInput) {
    console.error("[BDS:AUTO] Could not find native file input.");
    if (appState.ui?.showToast) {
      appState.ui.showToast("Could not find file input - auto-send aborted.");
    }
    return;
  }

  // Inject the file
  const dt = new DataTransfer();
  if (nativeInput.files) {
    for (let i = 0; i < nativeInput.files.length; i++) {
      dt.items.add(nativeInput.files[i]);
    }
  }
  dt.items.add(file);
  nativeInput.files = dt.files;
  nativeInput.dispatchEvent(new Event("change", { bubbles: true }));

  let editor = findChatEditor();
  if (autoMessage) {
    editor = writeTextToChatEditor(autoMessage, editor) || editor;
  }

  robustSend({
    editor,
    logPrefix: "[BDS:AUTO]",
    onFailure: () => {
      if (appState.ui?.showToast) {
        appState.ui.showToast(
          "Could not send the file automatically - please click Send manually.",
        );
      }
    },
  });
}
