import { mutatePayload, resolveConversationId } from "./payload-mutator.js";

/**
 * Patch window.fetch to intercept chat completion requests.
 *
 * @param {object} state - The injected script state
 * @param {function} isChatCompletionUrl
 * @param {function} markStart
 * @param {function} markEnd
 */
export function patchFetch(state, isChatCompletionUrl, markStart, markEnd) {
  const originalFetch = window.fetch;

  window.fetch = async function patchedFetch(input, init) {
    try {
      const url = extractUrl(input);
      if (!isChatCompletionUrl(url)) {
        return originalFetch.apply(this, arguments);
      }

      markStart(url);

      try {
        const requestInfo = await buildMutatedFetchRequest(
          input,
          init,
          state
        );
        if (!requestInfo) {
          return await originalFetch.apply(this, arguments);
        }

        const response = await originalFetch.call(
          this,
          requestInfo.input,
          requestInfo.init
        );

        // Clone and capture the raw SSE markdown before DeepSeek's
        // renderer strips whitespace/indentation from code blocks.
        if (response && response.ok && requestInfo.convId) {
          captureResponseMarkdown(response, requestInfo.convId);
        }

        return response;
      } finally {
        markEnd(url);
      }
    } catch (error) {
      console.warn("[BetterDeepSeek] Request patch failed:", error);
      return originalFetch.apply(this, arguments);
    }
  };
}

/**
 * Extract URL string from various fetch input types.
 */
export function extractUrl(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (input instanceof Request) {
    return input.url;
  }
  return "";
}

/**
 * Build a mutated fetch request with injected content.
 */
async function buildMutatedFetchRequest(input, init, state) {
  const bodyText = await extractBodyText(input, init);
  if (!bodyText) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return null;
  }

  const mutation = mutatePayload(payload, state);
  if (!mutation.changed) {
    return null;
  }

  const convId = resolveConversationId(payload);

  const nextBody = JSON.stringify(mutation.payload);
  const sourceHeaders =
    init && init.headers
      ? init.headers
      : input instanceof Request
        ? input.headers
        : undefined;
  const headers = new Headers(sourceHeaders || {});
  headers.set("content-type", "application/json");

  const nextInit = {
    method:
      (init && init.method) ||
      (input instanceof Request ? input.method : "POST"),
    headers,
    body: nextBody,
    credentials:
      (init && init.credentials) ||
      (input instanceof Request ? input.credentials : undefined),
    cache:
      (init && init.cache) ||
      (input instanceof Request ? input.cache : undefined),
    mode:
      (init && init.mode) ||
      (input instanceof Request ? input.mode : undefined),
    redirect:
      (init && init.redirect) ||
      (input instanceof Request ? input.redirect : undefined),
    referrer:
      (init && init.referrer) ||
      (input instanceof Request ? input.referrer : undefined),
    referrerPolicy:
      (init && init.referrerPolicy) ||
      (input instanceof Request ? input.referrerPolicy : undefined),
    keepalive:
      (init && init.keepalive) ||
      (input instanceof Request ? input.keepalive : undefined),
    integrity:
      (init && init.integrity) ||
      (input instanceof Request ? input.integrity : undefined),
    signal:
      (init && init.signal) ||
      (input instanceof Request ? input.signal : undefined),
  };

  const nextInput =
    typeof input === "string" || input instanceof URL ? input : input.url;
  return { input: nextInput, init: nextInit, convId };
}

/**
 * Extract body text from fetch arguments.
 */
async function extractBodyText(input, init) {
  if (init && typeof init.body === "string") {
    return init.body;
  }

  if (init && init.body instanceof URLSearchParams) {
    return init.body.toString();
  }

  if (input instanceof Request) {
    const cloned = input.clone();
    return cloned.text();
  }

  return "";
}

/**
 * Clone the response, read its streaming SSE body, and accumulate the raw
 * markdown before DeepSeek's renderer strips whitespace from code blocks.
 * Stores result in localStorage so the content script can use it for
 * create_file content extraction with perfect indentation.
 */
function captureResponseMarkdown(response, convId) {
  try {
    const cloned = response.clone();
    // Read asynchronously — don't block the response from reaching DeepSeek
    cloned.text().then((sseText) => {
      const markdown = parseSSEToMarkdown(sseText);
      if (markdown) {
        try {
          const key = "bds_raw_" + convId;
          localStorage.setItem(key, markdown);
          // Also store as "latest" with timestamp for freshness check
          localStorage.setItem("bds_raw_latest", markdown);
          localStorage.setItem("bds_raw_latest_ts", String(Date.now()));
          pruneRawMarkdown();
        } catch (_) { /* localStorage full — drop oldest */ }
      }
    }).catch(() => {});
  } catch (_) { /* clone failed — response already consumed */ }
}

/**
 * Parse Server-Sent Events to extract the concatenated markdown content.
 * DeepSeek SSE format:  data: {"type":"text","content":"..."}
 *                        data: [DONE]
 */
function parseSSEToMarkdown(sseText) {
  const chunks = [];
  const lines = sseText.split("\n");
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6);
    if (data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data);
      // DeepSeek can use either a top-level "content" field or the
      // OpenAI-style choices[0].delta.content path.
      const text =
        (parsed.type === "text" && parsed.content) ||
        (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content);
      if (text) {
        chunks.push(text);
      }
    } catch (_) { /* skip malformed lines */ }
  }
  return chunks.join("");
}

/**
 * Keep at most 10 raw-markdown entries to avoid localStorage bloat.
 */
function pruneRawMarkdown() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("bds_raw_") && key !== "bds_raw_latest") {
      keys.push(key);
    }
  }
  if (keys.length > 10) {
    keys.sort();
    for (let i = 0; i < keys.length - 10; i++) {
      localStorage.removeItem(keys[i]);
    }
  }
}
