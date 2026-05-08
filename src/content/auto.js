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

// Keep track of already processing/processed URLs globally so we don't spam
const processedWebFetches = new Set();
const processedGitHubFetches = new Set();
const processedTwitterFetches = new Set();
const processedYouTubeFetches = new Set();

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
  if (processedWebFetches.has(url)) return;
  processedWebFetches.add(url);

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
    processedWebFetches.delete(url);

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
  }
}

export async function handleAutoGitHubFetch(repoUrl) {
  if (processedGitHubFetches.has(repoUrl)) return;
  processedGitHubFetches.add(repoUrl);

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
  }
}

export async function handleAutoTwitterFetch(url) {
  if (processedTwitterFetches.has(url)) return;
  processedTwitterFetches.add(url);

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
  }
}

export async function handleAutoYouTubeFetch(url) {
  if (processedYouTubeFetches.has(url)) return;
  processedYouTubeFetches.add(url);

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
