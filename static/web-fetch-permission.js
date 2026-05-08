(function () {
  const params = new URLSearchParams(window.location.search);
  const rawUrl = String(params.get("url") || "").trim();
  const requestId = String(params.get("requestId") || "").trim();
  const returnOrigin = String(params.get("returnOrigin") || "").trim() || "*";
  const RESULT_MESSAGE_TYPE = "bds:web-fetch-permission-result";

  const copyEl = document.getElementById("bds-copy");
  const originEl = document.getElementById("bds-origin");
  const statusEl = document.getElementById("bds-status");
  const allowButton = document.getElementById("bds-allow");
  const cancelButton = document.getElementById("bds-cancel");

  function deriveOrigin(url) {
    try {
      return new URL(url).origin;
    } catch {
      return url || "this site";
    }
  }

  function buildOriginPattern(url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https sites can be granted.");
    }
    return `${parsed.protocol}//${parsed.host}/*`;
  }

  function setStatus(message, state) {
    statusEl.textContent = message || "";
    statusEl.dataset.state = state || "";
  }

  function notifyOpener(payload) {
    if (!window.opener || typeof window.opener.postMessage !== "function") {
      return;
    }

    try {
      window.opener.postMessage(
        {
          type: RESULT_MESSAGE_TYPE,
          requestId,
          ...payload,
        },
        returnOrigin || "*",
      );
    } catch {
      // Ignore cross-window notification failures. The opener has a focus
      // fallback that rechecks the granted permission when the popup closes.
    }
  }

  async function containsPermission(originPattern) {
    if (!chrome.permissions || typeof chrome.permissions.contains !== "function") {
      return false;
    }
    return Boolean(await chrome.permissions.contains({ origins: [originPattern] }));
  }

  async function requestPermission(originPattern) {
    if (!chrome.permissions || typeof chrome.permissions.request !== "function") {
      throw new Error(
        "This browser build does not expose the permissions API on extension pages.",
      );
    }

    const granted = Boolean(
      await chrome.permissions.request({ origins: [originPattern] }),
    );
    if (granted) {
      return true;
    }

    return await containsPermission(originPattern);
  }

  const origin = deriveOrigin(rawUrl);
  originEl.textContent = origin;
  copyEl.textContent =
    `Grant Better DeepSeek access to ${origin} so Web Fetch can read the page ` +
    "and attach it to the chat.";

  if (!rawUrl) {
    allowButton.disabled = true;
    setStatus("No site URL was provided.", "error");
    return;
  }

  let originPattern = "";
  try {
    originPattern = buildOriginPattern(rawUrl);
  } catch (error) {
    allowButton.disabled = true;
    setStatus(String(error && error.message ? error.message : error), "error");
    return;
  }

  cancelButton.addEventListener("click", () => {
    notifyOpener({
      granted: false,
      error: `Permission request was cancelled for ${origin}.`,
    });
    window.close();
  });

  allowButton.addEventListener("click", async () => {
    allowButton.disabled = true;
    cancelButton.disabled = true;
    setStatus("Waiting for the browser permission prompt...", "");

    try {
      const granted = await requestPermission(originPattern);
      if (!granted) {
        setStatus(`Permission was not granted for ${origin}.`, "error");
        notifyOpener({
          granted: false,
          error: `Permission was not granted for ${origin}.`,
        });
        return;
      }

      setStatus("Access granted. Returning to Better DeepSeek...", "success");
      notifyOpener({
        granted: true,
        origin,
      });
      window.setTimeout(() => {
        window.close();
      }, 180);
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      setStatus(message, "error");
      notifyOpener({
        granted: false,
        error: message,
      });
    } finally {
      if (statusEl.dataset.state !== "success") {
        allowButton.disabled = false;
        cancelButton.disabled = false;
      }
    }
  });
})();
