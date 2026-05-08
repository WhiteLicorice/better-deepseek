<script>
  import { onDestroy } from "svelte";
  import Drawer from "./Drawer.svelte";
  import ToastStack from "./ToastStack.svelte";
  import QuestionPanel from "./QuestionPanel.svelte";
  import WebFetchPermissionModal from "./WebFetchPermissionModal.svelte";
  import WhatsNewModal from "./WhatsNewModal.svelte";
  import {
    isFirefoxPermissionWindowFlow,
    openWebFetchPermissionWindow,
    waitForWebFetchPermissionGrant,
  } from "../web-fetch-permission.js";
  import appState from "../state.js";

  let drawerOpen = $state(false);
  let whatsNewPending = $state(appState.whatsNewPending);
  let webFetchPermissionRequest = $state(null);
  let webFetchPermissionResolver = null;
  let webFetchPermissionAbortController = null;
  let webFetchPermissionPopup = null;

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
        url: safeUrl,
        origin,
        message,
        errorMessage: "",
        busy: false,
        awaitingExternalGrant: false,
      };
    });
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
    if (webFetchPermissionAbortController) {
      webFetchPermissionAbortController.abort();
      webFetchPermissionAbortController = null;
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

  async function startExternalWebFetchPermissionFlow(currentRequest) {
    const popupWindow = openWebFetchPermissionWindow(currentRequest.url);
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

    const abortController = new AbortController();
    webFetchPermissionAbortController = abortController;
    webFetchPermissionPopup = popupWindow;
    webFetchPermissionRequest = {
      ...currentRequest,
      busy: false,
      awaitingExternalGrant: true,
      errorMessage: "",
    };

    try {
      const granted = await waitForWebFetchPermissionGrant(currentRequest.url, {
        popupWindow,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) {
        return;
      }

      if (granted) {
        resolveWebFetchPermissionRequest(true);
        return;
      }

      if (webFetchPermissionRequest?.url !== currentRequest.url) {
        return;
      }

      cleanupWebFetchPermissionSideEffects();
      webFetchPermissionRequest = {
        ...currentRequest,
        busy: false,
        awaitingExternalGrant: false,
        errorMessage:
          `Permission was not granted for ${currentRequest.origin}. ` +
          "Reopen the permission window and approve the browser prompt to continue.",
      };
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      cleanupWebFetchPermissionSideEffects();
      webFetchPermissionRequest = {
        ...currentRequest,
        busy: false,
        awaitingExternalGrant: false,
        errorMessage: String(error?.message || error),
      };
    }
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

  onDestroy(() => {
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
