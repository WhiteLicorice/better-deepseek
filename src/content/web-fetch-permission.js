const WEB_FETCH_PERMISSION_WINDOW_PATH = "static/web-fetch-permission.html";
const WEB_FETCH_PERMISSION_WINDOW_NAME = "bds-web-fetch-permission";
const WEB_FETCH_PERMISSION_WINDOW_FEATURES =
  "popup=yes,width=480,height=720,resizable=yes,scrollbars=yes";
const WEB_FETCH_PERMISSION_POLL_INTERVAL_MS = 300;
const WEB_FETCH_PERMISSION_TIMEOUT_MS = 120000;

function delay(ms, signal) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    function cleanup() {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
    }

    function handleAbort() {
      cleanup();
      resolve();
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export function isFirefoxPermissionWindowFlow() {
  return (process.env.BDS_TARGET || "chrome") === "firefox";
}

export function buildWebFetchPermissionWindowUrl(url) {
  const helperUrl = new URL(
    chrome.runtime.getURL(WEB_FETCH_PERMISSION_WINDOW_PATH),
  );
  helperUrl.searchParams.set("url", String(url || "").trim());
  return helperUrl.toString();
}

export function openWebFetchPermissionWindow(url) {
  const popup = window.open(
    buildWebFetchPermissionWindowUrl(url),
    WEB_FETCH_PERMISSION_WINDOW_NAME,
    WEB_FETCH_PERMISSION_WINDOW_FEATURES,
  );

  if (popup && typeof popup.focus === "function") {
    popup.focus();
  }

  return popup;
}

export async function waitForWebFetchPermissionGrant(
  url,
  options = {},
) {
  const signal = options.signal || null;
  const popupWindow = options.popupWindow || null;
  const intervalMs =
    Number.isFinite(options.intervalMs) && options.intervalMs > 0
      ? Number(options.intervalMs)
      : WEB_FETCH_PERMISSION_POLL_INTERVAL_MS;
  const timeoutMs =
    Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? Number(options.timeoutMs)
      : WEB_FETCH_PERMISSION_TIMEOUT_MS;
  const startedAt = Date.now();

  while (!signal?.aborted) {
    const response = await chrome.runtime.sendMessage({
      type: "bds-ensure-host-permission",
      url,
      interactive: false,
    });

    if (response?.ok && response?.granted) {
      return true;
    }

    if (signal?.aborted) {
      return false;
    }

    if (popupWindow && popupWindow.closed) {
      return false;
    }

    if ((Date.now() - startedAt) >= timeoutMs) {
      return false;
    }

    await delay(intervalMs, signal);
  }

  return false;
}
