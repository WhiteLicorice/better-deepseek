<script>
  let { runId = "", status = null, raw = "" } = $props();

  let parsedStatus = $derived.by(() => {
    if (status && typeof status === "object") return status;
    return null;
  });

  let completedSteps = $derived(parsedStatus ? (parsedStatus.completedSteps || 0) : 0);
  let totalSteps = $derived(parsedStatus ? (parsedStatus.totalSteps || 0) : 0);
  let currentAction = $derived(parsedStatus ? (parsedStatus.currentAction || "") : "");
  let progress = $derived(totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0);
</script>

<div class="bds-deep-research-status-card" data-testid="deep-research-status-card">
  <div class="bds-drs-header">
    <span class="bds-drs-icon">DR</span>
    <span class="bds-drs-title">Deep Research in Progress</span>
    {#if runId}
      <span class="bds-drs-run-id">Run: {runId.slice(0, 8)}</span>
    {/if}
  </div>

  {#if parsedStatus}
    <div class="bds-drs-progress">
      <div class="bds-drs-bar-bg">
        <div class="bds-drs-bar-fill" style="width: {progress}%"></div>
      </div>
      <span class="bds-drs-progress-text">{completedSteps}/{totalSteps} steps ({progress}%)</span>
    </div>
    {#if currentAction}
      <div class="bds-drs-current">Current: {currentAction}</div>
    {/if}
  {:else if raw}
    <pre class="bds-drs-raw">{raw}</pre>
  {/if}
</div>

<style>
  .bds-deep-research-status-card {
    margin: 8px 0;
    border: 1px solid var(--bds-border, #3a3b3f);
    border-radius: 12px;
    background: var(--bds-bg-panel, #1e1f23);
    color: var(--bds-text-primary, #ececec);
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .bds-drs-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
  }
  .bds-drs-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    color: var(--bds-accent, #4f8cff);
    background: var(--bds-bg-elevated, #25262b);
    border: 1px solid var(--bds-border, #3a3b3f);
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .bds-drs-title { font-size: 13px; font-weight: 600; flex: 1; }
  .bds-drs-run-id {
    font-size: 10.5px;
    color: var(--bds-text-tertiary, rgba(255, 255, 255, 0.5));
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .bds-drs-progress {
    padding: 10px 14px 0;
    border-top: 1px solid var(--bds-border, #3a3b3f);
  }
  .bds-drs-bar-bg {
    height: 8px;
    background: var(--bds-bg-elevated, #25262b);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .bds-drs-bar-fill {
    height: 100%;
    background: var(--bds-accent, #4f8cff);
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .bds-drs-progress-text {
    font-size: 11px;
    color: var(--bds-text-tertiary, rgba(255, 255, 255, 0.5));
  }
  .bds-drs-current {
    padding: 6px 14px 12px;
    font-size: 12px;
    color: var(--bds-text-secondary, rgba(255, 255, 255, 0.7));
  }
  .bds-drs-raw {
    margin: 0;
    border-top: 1px solid var(--bds-border, #3a3b3f);
    font-size: 11px;
    overflow-x: auto;
    background: var(--bds-bg-elevated, #25262b);
    padding: 10px 14px;
  }
</style>
