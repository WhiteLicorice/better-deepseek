const WEB_FETCH_PERMISSION_WINDOW_PATH = "static/web-fetch-permission.html";
const WEB_FETCH_PERMISSION_WINDOW_NAME = "bds-web-fetch-permission";
const WEB_FETCH_PERMISSION_WINDOW_FEATURES =
  "popup=yes,width=480,height=720,resizable=yes,scrollbars=yes";
export const WEB_FETCH_PERMISSION_WINDOW_MESSAGE_TYPE =
  "bds:web-fetch-permission-result";
export const WEB_FETCH_PERMISSION_REGISTER_MESSAGE_TYPE =
  "bds-register-web-fetch-permission-request";
export const WEB_FETCH_PERMISSION_COMPLETE_MESSAGE_TYPE =
  "bds-complete-web-fetch-permission-request";
export const WEB_FETCH_PERMISSION_RELAY_MESSAGE_TYPE =
  "bds-web-fetch-permission-request-complete";

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

export function isDeadObjectAccessError(error) {
  const message = String(error && error.message ? error.message : error);
  return error instanceof TypeError && /dead object/i.test(message);
}

export async function checkWebFetchPermissionGrant(url) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "bds-ensure-host-permission",
      url,
      interactive: false,
    });

    return Boolean(response?.ok && response?.granted);
  } catch (error) {
    if (isDeadObjectAccessError(error)) {
      return false;
    }
    throw error;
  }
}
