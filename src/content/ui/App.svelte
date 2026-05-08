<script>
  import { onDestroy, onMount } from "svelte";
  import Drawer from "./Drawer.svelte";
  import ToastStack from "./ToastStack.svelte";
  import QuestionPanel from "./QuestionPanel.svelte";
  import WebFetchPermissionModal from "./WebFetchPermissionModal.svelte";
  import WhatsNewModal from "./WhatsNewModal.svelte";
  import {
    checkWebFetchPermissionGrant,
    isFirefoxPermissionWindowFlow,
    isWebFetchPermissionWindowMessage,
    openWebFetchPermissionWindow,
    WEB_FETCH_PERMISSION_REGISTER_MESSAGE_TYPE,
    WEB_FETCH_PERMISSION_RELAY_MESSAGE_TYPE,
  } from "../web-fetch-permission.js";
  import appState from "../state.js";

  const WEB_FETCH_PERMISSION_RECHECK_INTERVAL_MS = 180;
  const WEB_FETCH_PERMISSION_RECHECK_MAX_ATTEMPTS = 30;

  let drawerOpen = $state(false);
  let whatsNewPending = $state(appState.whatsNewPending);
  let webFetchPermissionRequest = $state(null);
  let webFetchPermissionResolver = null;
  let webFetchPermissionPopup = null;
  let webFetchPermissionRequestCounter = 0;
  let webFetchPermissionRecheckTimer = 0;

  /** @type {Array<{id: number, message: string}>} */
  let toasts = $state([]);
  let toastId = 0;

  // ── Public API (called from non-Svelte code via mount.js) ──

  export function showToast(message) {
    const id = ++toastId;
    toasts = [...toasts, { id, message }];

    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 2880);
  }

  export function showLongWorkOverlay(_visible) {}

  export function requestWebFetchPermission(details = {}) {
    const safeUrl = String(details.url || "").trim();
    if (!safeUrl) {
      return Promise.resolve(false);
    }

    if (webFetchPermissionResolver) {
      resolveWebFetchPermissionRequest(false);
    }

    const origin = String(details.origin || deriveOrigin(safeUrl)).trim();
    const message =
      String(details.message || "").trim() ||
      `Better DeepSeek needs access to ${origin} before Web Fetch can continue.`;

    return new Promise((resolve) => {
      webFetchPermissionResolver = resolve;
      webFetchPermissionRequest = {
        requestId: createWebFetchPermissionRequestId(),
        url: safeUrl,
        origin,
        message,
        errorMessage: "",
        busy: false,
        awaitingExternalGrant: false,
      };
    });
  }

  function createWebFetchPermissionRequestId() {
    webFetchPermissionRequestCounter += 1;
    return `bds-web-fetch-${Date.now()}-${webFetchPermissionRequestCounter}`;
  }

  // Settings/skills/memories refresh — forwarded to Drawer
  let drawerRef = $state(null);

  export function refreshSettings() {
    if (drawerRef) drawerRef.refreshSettings();
  }
  export function refreshSkills() {
    if (drawerRef) drawerRef.refreshSkills();
  }
  export function refreshCharacters() {
    if (drawerRef) drawerRef.refreshCharacters();
  }
  export function refreshMemories() {
    if (drawerRef) drawerRef.refreshMemories();
  }
  export function refreshProjects() {
    if (drawerRef) drawerRef.refreshProjects();
    if (appState.heroBarRef) appState.heroBarRef.refresh();
  }

  export function refreshWhatsNew() {
    whatsNewPending = appState.whatsNewPending;
  }

  function toggleDrawer() {
    drawerOpen = !drawerOpen;
  }

  function closeDrawer() {
    drawerOpen = false;
  }

  function deriveOrigin(url) {
    try {
      return new URL(url).origin;
    } catch {
      return url || "this site";
    }
  }

  function cleanupWebFetchPermissionSideEffects() {
    if (webFetchPermissionRecheckTimer) {
      clearTimeout(webFetchPermissionRecheckTimer);
      webFetchPermissionRecheckTimer = 0;
    }

    if (webFetchPermissionPopup && !webFetchPermissionPopup.closed) {
      try {
        webFetchPermissionPopup.close();
      } catch {
        // Ignore close failures from the browser.
      }
    }

    webFetchPermissionPopup = null;
  }

  function resolveWebFetchPermissionRequest(granted) {
    cleanupWebFetchPermissionSideEffects();
    const resolve = webFetchPermissionResolver;
    webFetchPermissionResolver = null;
    webFetchPermissionRequest = null;
    if (resolve) {
      resolve(Boolean(granted));
    }
  }

  function dismissWebFetchPermissionRequest() {
    resolveWebFetchPermissionRequest(false);
  }

  function failWebFetchPermissionRequest(currentRequest, errorMessage) {
    cleanupWebFetchPermissionSideEffects();
    webFetchPermissionRequest = {
      ...currentRequest,
      busy: false,
      awaitingExternalGrant: false,
      errorMessage,
    };
  }

  async function runWebFetchPermissionRecheck(requestId, attempt = 0) {
    const currentRequest = webFetchPermissionRequest;
    if (
      !currentRequest?.awaitingExternalGrant ||
      currentRequest.requestId !== requestId
    ) {
      return;
    }

    try {
      const granted = await checkWebFetchPermissionGrant(currentRequest.url);
      if (granted) {
        resolveWebFetchPermissionRequest(true);
        return;
      }
    } catch (error) {
      failWebFetchPermissionRequest(
        currentRequest,
        String(error?.message || error),
      );
      return;
    }

    const popupClosed = Boolean(
      webFetchPermissionPopup && webFetchPermissionPopup.closed,
    );
    if (popupClosed && attempt >= WEB_FETCH_PERMISSION_RECHECK_MAX_ATTEMPTS) {
      failWebFetchPermissionRequest(
        currentRequest,
        `Permission was not granted for ${currentRequest.origin}. ` +
          "Reopen the permission window and approve the browser prompt to continue.",
      );
      return;
    }

    if (webFetchPermissionRecheckTimer) {
      clearTimeout(webFetchPermissionRecheckTimer);
    }
    webFetchPermissionRecheckTimer = window.setTimeout(() => {
      webFetchPermissionRecheckTimer = 0;
      void runWebFetchPermissionRecheck(requestId, attempt + 1);
    }, WEB_FETCH_PERMISSION_RECHECK_INTERVAL_MS);
  }

  function beginWebFetchPermissionRecheck(requestId) {
    if (!requestId) {
      return;
    }
    if (webFetchPermissionRecheckTimer) {
      clearTimeout(webFetchPermissionRecheckTimer);
      webFetchPermissionRecheckTimer = 0;
    }
    void runWebFetchPermissionRecheck(requestId, 0);
  }

  function handleWebFetchPermissionWindowMessage(event) {
    if (!webFetchPermissionRequest) {
      return;
    }

    const data = event?.data;
    if (!isWebFetchPermissionWindowMessage(data)) {
      return;
    }

    if (data.requestId !== webFetchPermissionRequest.requestId) {
      return;
    }

    if (data.granted) {
      beginWebFetchPermissionRecheck(data.requestId);
      return;
    }

    failWebFetchPermissionRequest(
      webFetchPermissionRequest,
      String(data.error || "").trim() ||
        `Permission was not granted for ${webFetchPermissionRequest.origin}.`,
    );
  }

  function handleRuntimeWebFetchPermissionMessage(message) {
    if (!webFetchPermissionRequest) {
      return false;
    }

    if (message?.type !== WEB_FETCH_PERMISSION_RELAY_MESSAGE_TYPE) {
      return false;
    }

    if (message.requestId !== webFetchPermissionRequest.requestId) {
      return false;
    }

    if (message.granted) {
      beginWebFetchPermissionRecheck(message.requestId);
      return false;
    }

    failWebFetchPermissionRequest(
      webFetchPermissionRequest,
      String(message.error || "").trim() ||
        `Permission was not granted for ${webFetchPermissionRequest.origin}.`,
    );
    return false;
  }

  async function startExternalWebFetchPermissionFlow(currentRequest) {
    try {
      await chrome.runtime.sendMessage({
        type: WEB_FETCH_PERMISSION_REGISTER_MESSAGE_TYPE,
        requestId: currentRequest.requestId,
        url: currentRequest.url,
      });
    } catch {
      // The helper window still has postMessage/focus fallbacks if background
      // request registration is unavailable.
    }

    const popupWindow = openWebFetchPermissionWindow(currentRequest.url, {
      requestId: currentRequest.requestId,
      returnOrigin: window.location.origin,
    });
    if (!popupWindow) {
      webFetchPermissionRequest = {
        ...currentRequest,
        busy: false,
        awaitingExternalGrant: false,
        errorMessage:
          `Better DeepSeek could not open its permission window for ${currentRequest.origin}. ` +
          "Allow that site or All Sites from the extension permissions, then try again.",
      };
      return;
    }

    cleanupWebFetchPermissionSideEffects();

    webFetchPermissionPopup = popupWindow;
    webFetchPermissionRequest = {
      ...currentRequest,
      busy: false,
      awaitingExternalGrant: true,
      errorMessage: "",
    };
  }

  async function confirmWebFetchPermissionRequest() {
    if (
      !webFetchPermissionRequest ||
      webFetchPermissionRequest.busy ||
      webFetchPermissionRequest.awaitingExternalGrant
    ) {
      return;
    }

    const currentRequest = webFetchPermissionRequest;

    if (isFirefoxPermissionWindowFlow()) {
      await startExternalWebFetchPermissionFlow(currentRequest);
      return;
    }

    webFetchPermissionRequest = {
      ...currentRequest,
      busy: true,
      errorMessage: "",
    };

    try {
      const response = await chrome.runtime.sendMessage({
        type: "bds-ensure-host-permission",
        url: currentRequest.url,
        interactive: true,
      });

      if (response?.ok) {
        resolveWebFetchPermissionRequest(true);
        return;
      }

      let errorMessage =
        response?.error ||
        `Could not get permission for ${currentRequest.origin}.`;

      if (response?.denied) {
        errorMessage =
          `Permission was denied for ${currentRequest.origin}. You can allow it from the extension permissions and try again.`;
      } else if (response?.permissionRequired && response?.promptUnavailable) {
        errorMessage =
          `This browser could not show the permission prompt here. Open the extension permissions and allow ${currentRequest.origin} or All Sites, then retry.`;
      } else if (response?.permissionRequired) {
        errorMessage =
          `Better DeepSeek still needs permission to access ${currentRequest.origin}. Approve the browser prompt to continue.`;
      }

      webFetchPermissionRequest = {
        ...currentRequest,
        busy: false,
        errorMessage,
      };
    } catch (error) {
      webFetchPermissionRequest = {
        ...currentRequest,
        busy: false,
        errorMessage: String(error?.message || error),
      };
    }
  }

  function handleWindowFocus() {
    if (webFetchPermissionRequest?.awaitingExternalGrant) {
      beginWebFetchPermissionRecheck(webFetchPermissionRequest.requestId);
    }
  }

  function handleVisibilityChange() {
    if (
      document.visibilityState === "visible" &&
      webFetchPermissionRequest?.awaitingExternalGrant
    ) {
      beginWebFetchPermissionRecheck(webFetchPermissionRequest.requestId);
    }
  }

  onMount(() => {
    window.addEventListener("message", handleWebFetchPermissionWindowMessage);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    chrome.runtime.onMessage.addListener(handleRuntimeWebFetchPermissionMessage);
  });

  onDestroy(() => {
    window.removeEventListener("message", handleWebFetchPermissionWindowMessage);
    window.removeEventListener("focus", handleWindowFocus);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    chrome.runtime.onMessage.removeListener(handleRuntimeWebFetchPermissionMessage);
    cleanupWebFetchPermissionSideEffects();
  });
</script>

<button id="bds-toggle" type="button" onclick={toggleDrawer}>BDS</button>

<Drawer bind:this={drawerRef} open={drawerOpen} onclose={closeDrawer} />

<ToastStack {toasts} />
<QuestionPanel />

{#if webFetchPermissionRequest}
  <WebFetchPermissionModal
    request={webFetchPermissionRequest}
    onConfirm={confirmWebFetchPermissionRequest}
    onDismiss={dismissWebFetchPermissionRequest}
  />
{/if}

{#if whatsNewPending}
  <WhatsNewModal onDismiss={() => whatsNewPending = false} />
{/if}
