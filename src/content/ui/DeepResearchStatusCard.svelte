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
    border: 1px solid var(--bds-border, #3a3b3f);
    border-radius: 8px;
    padding: 12px;
    margin: 8px 0;
    background: var(--bds-bg-panel, #1e1f23);
    font-size: 14px;
  }
  .bds-drs-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .bds-drs-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    color: #1976d2;
    background: rgba(25, 118, 210, 0.12);
    font-size: 10px;
    font-weight: 700;
  }
  .bds-drs-title { font-weight: 600; flex: 1; }
  .bds-drs-run-id { font-size: 11px; opacity: 0.6; font-family: monospace; }
  .bds-drs-progress { margin-bottom: 8px; }
  .bds-drs-bar-bg {
    height: 8px;
    background: var(--bds-bg-elevated, #25262b);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .bds-drs-bar-fill {
    height: 100%;
    background: #42a5f5;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .bds-drs-progress-text { font-size: 12px; opacity: 0.7; }
  .bds-drs-current { font-size: 13px; font-style: italic; opacity: 0.8; }
  .bds-drs-raw {
    font-size: 11px;
    overflow-x: auto;
    background: var(--bds-bg-elevated, #25262b);
    padding: 6px;
    border-radius: 4px;
  }
</style>
