<script>
  import { onMount } from "svelte";

  let {
    request,
    onConfirm = () => {},
    onDismiss = () => {},
  } = $props();

  let modalRef = $state(null);

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

      {#if request.errorMessage}
        <div class="bds-permission-error">{request.errorMessage}</div>
      {/if}

      <p class="bds-permission-hint">
        Better DeepSeek only needs access to fetch this page and convert it
        into an attachment for the chat.
      </p>
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
        disabled={request.busy}
      >
        {request.busy ? "Requesting..." : "Allow access"}
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
    background: rgba(9, 10, 14, 0.6);
    backdrop-filter: blur(4px);
  }

  .bds-permission-modal {
    width: min(92vw, 440px);
    background: #171920;
    color: #f5f7fb;
    border: 1px solid rgba(133, 147, 178, 0.22);
    border-radius: 18px;
    box-shadow: 0 24px 56px rgba(0, 0, 0, 0.4);
    outline: none;
    overflow: hidden;
  }

  .bds-permission-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 22px 16px;
    border-bottom: 1px solid rgba(133, 147, 178, 0.18);
  }

  .bds-permission-eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #8fb2ff;
    margin-bottom: 6px;
  }

  .bds-permission-header h2 {
    margin: 0;
    font-size: 20px;
    line-height: 1.2;
  }

  .bds-permission-close {
    border: none;
    background: transparent;
    color: #9aa4bb;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 4px 6px;
    border-radius: 8px;
  }

  .bds-permission-close:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .bds-permission-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    color: #e6ebf7;
  }

  .bds-permission-origin {
    display: inline-flex;
    align-self: flex-start;
    max-width: 100%;
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(143, 178, 255, 0.12);
    border: 1px solid rgba(143, 178, 255, 0.2);
    color: #cfe0ff;
    font-size: 12px;
    font-weight: 600;
    word-break: break-all;
  }

  .bds-permission-error {
    border-radius: 12px;
    padding: 12px 13px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.2);
    color: #ffb3b3;
    font-size: 13px;
    line-height: 1.5;
  }

  .bds-permission-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #9aa4bb;
  }

  .bds-permission-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 0 22px 22px;
  }

  .bds-permission-btn {
    border-radius: 11px;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .bds-permission-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .bds-permission-btn-secondary {
    background: transparent;
    color: #d7def0;
    border-color: rgba(133, 147, 178, 0.24);
  }

  .bds-permission-btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
  }

  .bds-permission-btn-primary {
    background: linear-gradient(135deg, #4d7cff 0%, #3f67dd 100%);
    color: #ffffff;
  }

  .bds-permission-btn-primary:hover:not(:disabled) {
    filter: brightness(1.06);
  }
 </style>
