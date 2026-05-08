<script>
  import { onMount } from "svelte";
  import { getSiteAccessGuide } from "../site-access-hint.js";

  let {
    request,
    onConfirm = () => {},
    onDismiss = () => {},
  } = $props();

  let modalRef = $state(null);
  const siteAccessGuide = getSiteAccessGuide();

  function handleKeydown(event) {
    if (event.key === "Escape" && !request.busy) {
      onDismiss();
    }
  }

  onMount(() => {
    if (modalRef) {
      modalRef.focus();
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="bds-permission-backdrop"
  onclick={() => {
    if (!request.busy) {
      onDismiss();
    }
  }}
  role="presentation"
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    bind:this={modalRef}
    class="bds-permission-modal"
    onclick={(event) => event.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="bds-permission-title"
    tabindex="-1"
  >
    <div class="bds-permission-header">
      <div>
        <div class="bds-permission-eyebrow">Web Fetch</div>
        <h2 id="bds-permission-title">Allow site access</h2>
      </div>
      <button
        class="bds-permission-close"
        type="button"
        onclick={onDismiss}
        disabled={request.busy}
        aria-label="Close"
      >
        x
      </button>
    </div>

    <div class="bds-permission-body">
      <p class="bds-permission-copy">{request.message}</p>
      <div class="bds-permission-origin">{request.origin}</div>

      {#if request.awaitingExternalGrant}
        <div class="bds-permission-info">
          A Better DeepSeek permission window was opened. Grant access there and
          this tab will continue automatically.
        </div>
      {/if}

      {#if request.errorMessage}
        <div class="bds-permission-error">{request.errorMessage}</div>
      {/if}

      <p class="bds-permission-hint">
        Better DeepSeek only needs access to fetch this page and convert it
        into an attachment for the chat.
      </p>

      {#if siteAccessGuide}
        <div class="bds-permission-note">
          <div class="bds-permission-note-title">Blanket access</div>
          <p>
            Tired of granting access for every site? Open
            <code>{siteAccessGuide.location}</code> and use
            {siteAccessGuide.pathTail} to {siteAccessGuide.action}. This removes
            repeated permission prompts for Web Fetch, YouTube Fetch, and other
            auto-tools.
          </p>
        </div>
      {/if}
    </div>

    <div class="bds-permission-footer">
      <button
        class="bds-permission-btn bds-permission-btn-secondary"
        type="button"
        onclick={onDismiss}
        disabled={request.busy}
      >
        Cancel
      </button>
      <button
        class="bds-permission-btn bds-permission-btn-primary"
        type="button"
        onclick={onConfirm}
        disabled={request.busy || request.awaitingExternalGrant}
      >
        {request.awaitingExternalGrant
          ? "Waiting for access..."
          : request.busy
            ? "Requesting..."
            : "Allow access"}
      </button>
    </div>
  </div>
</div>

<style>
  .bds-permission-backdrop {
    --bds-permission-bg: #f5f7fb;
    --bds-permission-surface: #ffffff;
    --bds-permission-border: #000000;
    --bds-permission-text: #000000;
    --bds-permission-muted: #475569;
    --bds-permission-accent: #1e3a8a;
    --bds-permission-shadow: 4px 4px 0 #000000;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.34);
    padding: 18px;
  }

  .bds-permission-modal {
    width: min(92vw, 440px);
    background: var(--bds-permission-surface);
    color: var(--bds-permission-text);
    border: 2px solid var(--bds-permission-border);
    border-radius: 0;
    box-shadow: var(--bds-permission-shadow);
    outline: none;
    overflow: hidden;
    font-family:
      "Inter",
      "Segoe UI",
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
  }

  .bds-permission-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 22px 16px;
    border-bottom: 2px solid var(--bds-permission-border);
  }

  .bds-permission-eyebrow {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bds-permission-accent);
    margin-bottom: 6px;
  }

  .bds-permission-header h2 {
    margin: 0;
    font-size: 22px;
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .bds-permission-close {
    border: 2px solid var(--bds-permission-border);
    background: var(--bds-permission-surface);
    color: var(--bds-permission-text);
    cursor: pointer;
    font-size: 14px;
    font-weight: 900;
    line-height: 1;
    padding: 8px 9px;
    border-radius: 0;
    box-shadow: 2px 2px 0 #000000;
    text-transform: uppercase;
  }

  .bds-permission-close:hover:not(:disabled) {
    transform: translate(-1px, -1px);
  }

  .bds-permission-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .bds-permission-body {
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .bds-permission-copy {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--bds-permission-text);
  }

  .bds-permission-origin {
    display: inline-flex;
    align-self: flex-start;
    max-width: 100%;
    padding: 8px 10px;
    border-radius: 0;
    background: var(--bds-permission-bg);
    border: 2px solid var(--bds-permission-border);
    color: var(--bds-permission-accent);
    font-size: 12px;
    font-weight: 800;
    word-break: break-all;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .bds-permission-error {
    padding: 12px 13px;
    background: #fff1f2;
    border: 2px solid var(--bds-permission-border);
    box-shadow: 4px 4px 0 #000000;
    color: #991b1b;
    font-size: 13px;
    line-height: 1.5;
  }

  .bds-permission-info {
    padding: 12px 13px;
    background: #eff6ff;
    border: 2px solid var(--bds-permission-border);
    box-shadow: 4px 4px 0 #000000;
    color: var(--bds-permission-text);
    font-size: 13px;
    line-height: 1.5;
  }

  .bds-permission-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--bds-permission-muted);
  }

  .bds-permission-note {
    padding: 14px;
    border: 2px solid var(--bds-permission-border);
    background: var(--bds-permission-bg);
    box-shadow: var(--bds-permission-shadow);
  }

  .bds-permission-note-title {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bds-permission-accent);
  }

  .bds-permission-note p {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    color: var(--bds-permission-text);
  }

  .bds-permission-note code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.95em;
    font-weight: 700;
    color: var(--bds-permission-accent);
  }

  .bds-permission-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 0 22px 22px;
  }

  .bds-permission-btn {
    border-radius: 0;
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
    border: 2px solid var(--bds-permission-border);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    box-shadow: 4px 4px 0 #000000;
  }

  .bds-permission-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }

  .bds-permission-btn-secondary {
    background: var(--bds-permission-surface);
    color: var(--bds-permission-text);
  }

  .bds-permission-btn-secondary:hover:not(:disabled) {
    transform: translate(-2px, -2px);
  }

  .bds-permission-btn-primary {
    background: var(--bds-permission-accent);
    color: #ffffff;
  }

  .bds-permission-btn-primary:hover:not(:disabled) {
    transform: translate(-2px, -2px);
  }
 </style>
