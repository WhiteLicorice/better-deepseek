const WEB_FETCH_PERMISSION_WINDOW_PATH = "static/web-fetch-permission.html";
const WEB_FETCH_PERMISSION_WINDOW_NAME = "bds-web-fetch-permission";
const WEB_FETCH_PERMISSION_WINDOW_FEATURES =
  "popup=yes,width=480,height=720,resizable=yes,scrollbars=yes";
export const WEB_FETCH_PERMISSION_WINDOW_MESSAGE_TYPE =
  "bds:web-fetch-permission-result";

export function isFirefoxPermissionWindowFlow() {
  return (process.env.BDS_TARGET || "chrome") === "firefox";
}

export function buildWebFetchPermissionWindowUrl(url, options = {}) {
  const helperUrl = new URL(
    chrome.runtime.getURL(WEB_FETCH_PERMISSION_WINDOW_PATH),
  );
  helperUrl.searchParams.set("url", String(url || "").trim());
  if (options.requestId) {
    helperUrl.searchParams.set("requestId", String(options.requestId));
  }
  if (options.returnOrigin) {
    helperUrl.searchParams.set("returnOrigin", String(options.returnOrigin));
  }
  return helperUrl.toString();
}

export function openWebFetchPermissionWindow(url, options = {}) {
  const popup = window.open(
    buildWebFetchPermissionWindowUrl(url, options),
    WEB_FETCH_PERMISSION_WINDOW_NAME,
    WEB_FETCH_PERMISSION_WINDOW_FEATURES,
  );

  if (popup && typeof popup.focus === "function") {
    popup.focus();
  }

  return popup;
}

export function isWebFetchPermissionWindowMessage(data) {
  return Boolean(
    data &&
    typeof data === "object" &&
    data.type === WEB_FETCH_PERMISSION_WINDOW_MESSAGE_TYPE,
  );
}

export async function checkWebFetchPermissionGrant(url) {
  const response = await chrome.runtime.sendMessage({
    type: "bds-ensure-host-permission",
    url,
    interactive: false,
  });

  return Boolean(response?.ok && response?.granted);
}
