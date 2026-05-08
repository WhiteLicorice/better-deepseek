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
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
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
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    padding: 18px;
    animation: bds-fade-in 0.15s ease;
  }

  .bds-permission-modal {
    width: min(92vw, 440px);
    background: var(--bds-bg-panel, #1e1f23);
    border: 1px solid var(--bds-border, #3a3b3f);
    border-radius: var(--bds-radius, 14px);
    box-shadow: var(--bds-shadow, 0 12px 40px rgba(0,0,0,0.4));
    color: var(--bds-text-primary, #ececec);
    outline: none;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    animation: bds-scale-in 0.18s ease;
  }

  @keyframes bds-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes bds-scale-in {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .bds-permission-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 22px 14px;
  }

  .bds-permission-eyebrow {
    font-size: 12px;
    font-weight: 600;
    color: var(--bds-text-tertiary, #6b6b7b);
    margin-bottom: 4px;
  }

  .bds-permission-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.3px;
    color: var(--bds-text-primary, #ececec);
  }

  .bds-permission-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    min-width: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bds-text-tertiary, #6b6b7b);
    cursor: pointer;
    padding: 0;
    transition: all 0.18s ease;
    margin-top: 2px;
  }

  .bds-permission-close:hover:not(:disabled) {
    background: var(--bds-bg-hover, rgba(255,255,255,0.08));
    color: var(--bds-text-primary, #ececec);
  }

  .bds-permission-close:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .bds-permission-body {
    padding: 0 22px 4px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .bds-permission-copy {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--bds-text-primary, #ececec);
  }

  .bds-permission-origin {
    display: inline-flex;
    align-self: flex-start;
    max-width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--bds-bg-elevated, #2a2b30);
    border: 1px solid var(--bds-border, #3a3b3f);
    color: var(--bds-accent, #5b7bff);
    font-size: 12px;
    font-weight: 600;
    word-break: break-all;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .bds-permission-error {
    padding: 12px 14px;
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid var(--bds-danger-border, rgba(248,113,113,0.35));
    border-radius: 10px;
    color: var(--bds-danger, #f87171);
    font-size: 13px;
    line-height: 1.5;
  }

  .bds-permission-info {
    padding: 12px 14px;
    background: var(--bds-accent-glow, rgba(91,123,255,0.15));
    border: 1px solid var(--bds-border, #3a3b3f);
    border-radius: 10px;
    color: var(--bds-text-primary, #ececec);
    font-size: 13px;
    line-height: 1.5;
  }

  .bds-permission-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--bds-text-secondary, #8e8ea0);
  }

  .bds-permission-note {
    padding: 14px;
    border: 1px solid var(--bds-border, #3a3b3f);
    border-radius: 10px;
    background: var(--bds-bg-elevated, #2a2b30);
  }

  .bds-permission-note-title {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--bds-text-tertiary, #6b6b7b);
  }

  .bds-permission-note p {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    color: var(--bds-text-secondary, #8e8ea0);
  }

  .bds-permission-note code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.95em;
    font-weight: 600;
    color: var(--bds-accent, #5b7bff);
  }

  .bds-permission-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 22px 20px;
  }

  .bds-permission-btn {
    border-radius: 10px;
    padding: 9px 18px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.18s ease;
  }

  .bds-permission-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .bds-permission-btn-secondary {
    border: 1px solid var(--bds-border, #3a3b3f);
    background: transparent;
    color: var(--bds-text-primary, #ececec);
  }

  .bds-permission-btn-secondary:hover:not(:disabled) {
    background: var(--bds-bg-hover, rgba(255,255,255,0.08));
    border-color: var(--bds-border-hover, #4a4b50);
  }

  .bds-permission-btn-primary {
    border: none;
    background: var(--bds-accent, #5b7bff);
    color: #ffffff;
  }

  .bds-permission-btn-primary:hover:not(:disabled) {
    opacity: 0.88;
  }

  .bds-permission-btn-primary:active:not(:disabled) {
    transform: scale(0.98);
  }
  </style>
