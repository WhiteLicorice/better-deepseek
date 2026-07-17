/**
 * Load All History — intercepts DeepSeek's `/api/v0/chat/history_messages`
 * API call (via the injected script's fetch/XHR patch) to obtain every message
 * in the session along with accurate `accumulated_token_usage`.
 *
 * Default: off (opt-in via settings.loadAllHistoryOnSession).
 * When enabled, runs automatically on session open AND on-demand before
 * export / select-all / price recalculation.
 */

import state from "./state.js";

const HISTORY_MSGS_TIMEOUT = 10000;

/** @type {Map<string, Promise<?Array>>} per-session pending loads */
const pendingBySession = new Map();
const _fullHistoryLoaded = new Set();

export function isLoadInProgress() {
  return pendingBySession.size > 0;
}

/**
 * Get the current session ID from the URL.
 * @returns {string|null}
 */
function getSessionId() {
  const match = String(location.href || "").match(/\/chat\/s\/([^/?#]+)/);
  return match ? match[1] : null;
}

/**
 * Evict every session's cached messages except the given one.
 * Pass `null` to clear everything.
 *
 * @param {string|null} sessionId
 */
export function retainOnlyHistorySession(sessionId) {
  for (const key of state.chatMessagesBySession.keys()) {
    if (key !== sessionId) {
      state.chatMessagesBySession.delete(key);
    }
  }
  for (const key of _fullHistoryLoaded) {
    if (key !== sessionId) {
      _fullHistoryLoaded.delete(key);
    }
  }
  // Reject stale pending promises so they don't block the new session
  for (const [key, promise] of pendingBySession) {
    if (key !== sessionId) {
      // Don't reject — just remove so it can't resolve into the cache
      pendingBySession.delete(key);
    }
  }
  if (sessionId === null) {
    state.chatMessagesBySession.clear();
    _fullHistoryLoaded.clear();
    pendingBySession.clear();
  }
}

/**
 * Wait for the `bds:history-msgs-loaded` event.
 * @param {string} sessionId
 * @returns {Promise<boolean>} true if data was loaded
 */
function waitForHistoryData(sessionId) {
  return new Promise((resolve) => {
    const handler = (event) => {
      let detail = event.detail;
      if (typeof detail === "string") {
        try { detail = JSON.parse(detail); } catch { return; }
      }
      // Ignore responses for sessions other than the one we're waiting on
      if (detail?.sessionId !== sessionId) return;
      window.removeEventListener("bds:history-msgs-loaded", handler);
      resolve(true);
    };
    window.addEventListener("bds:history-msgs-loaded", handler);
    setTimeout(() => {
      window.removeEventListener("bds:history-msgs-loaded", handler);
      resolve(false);
    }, HISTORY_MSGS_TIMEOUT);
  });
}

/**
 * Load all messages for the current session via the history_messages API.
 *
 * Returns an array of API message objects (or null if unavailable):
 *   { message_id, role, fragments, accumulated_token_usage, ... }
 *
 * Callers can pass these to `collectMessagesFromApi()` in exporter.js.
 */
export async function loadAllHistory() {
  const sessionId = getSessionId();
  if (!sessionId) {
    return null;
  }

  // Check per-session pending — never block on a different session's load
  const existing = pendingBySession.get(sessionId);
  if (existing) {
    return existing;
  }

  // Only trust cache if a full explicit load was previously completed
  if (_fullHistoryLoaded.has(sessionId)) {
    const messages = state.chatMessagesBySession.get(sessionId);
    return messages && messages.length > 0 ? messages : null;
  }

  const promise = (async () => {
    window.dispatchEvent(new CustomEvent("bds:request-history-msgs", {
      detail: JSON.stringify({ sessionId })
    }));

    const loaded = await waitForHistoryData(sessionId);

    if (loaded && state.chatMessagesBySession.has(sessionId)) {
      const messages = state.chatMessagesBySession.get(sessionId);
      _fullHistoryLoaded.add(sessionId);
      if (messages.length > 0) return messages;
    }

    return null;
  })();

  pendingBySession.set(sessionId, promise);

  try {
    return await promise;
  } finally {
    pendingBySession.delete(sessionId);
  }
}
