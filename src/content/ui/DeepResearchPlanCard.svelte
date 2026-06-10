<script>
  let {
    runId = "",
    plan = null,
    raw = "",
    error = "",
    onApprove = null,
    onRequestChanges = null,
    onCancel = null,
  } = $props();

  let parsedPlan = $derived.by(() => {
    if (plan && typeof plan === "object") return plan;
    return null;
  });

  let steps = $derived(parsedPlan && Array.isArray(parsedPlan.steps) ? parsedPlan.steps : []);
  let title = $derived(parsedPlan ? (parsedPlan.title || "Research Plan") : "Research Plan");
  let hasMalformedJson = $derived(!parsedPlan && (!!raw || !!error));

  let feedbackText = $state("");
  let showFeedback = $state(false);

  function handleApprove() {
    if (onApprove) onApprove(runId);
  }

  function handleRequestChanges() {
    if (!showFeedback) {
      showFeedback = true;
      return;
    }
    if (onRequestChanges && feedbackText.trim()) {
      onRequestChanges(runId, feedbackText.trim());
      feedbackText = "";
      showFeedback = false;
    }
  }

  function handleCancel() {
    if (onCancel) onCancel(runId);
  }
</script>

<div class="bds-deep-research-plan-card" data-testid="deep-research-plan-card">
  <div class="bds-dr-header">
    <span class="bds-dr-icon">DR</span>
    <span class="bds-dr-title">{title}</span>
    {#if runId}
      <span class="bds-dr-run-id">Run: {runId.slice(0, 8)}</span>
    {/if}
  </div>

  {#if hasMalformedJson}
    <div class="bds-dr-error">
      <p>Failed to parse research plan JSON</p>
      {#if error}
        <pre class="bds-dr-error-detail">{error}</pre>
      {/if}
      {#if raw}
        <pre class="bds-dr-raw">{raw}</pre>
      {/if}
    </div>
  {:else if parsedPlan}
    <div class="bds-dr-steps">
      {#each steps as step, i}
        <div class="bds-dr-step">
          <span class="bds-dr-step-num">{step.id || i + 1}.</span>
          <span
            class="bds-dr-step-action"
            class:search={step.action === "search"}
            class:fetch={step.action === "fetch"}
          >
            {step.action || "search"}
          </span>
          <span class="bds-dr-step-query">{step.query || ""}</span>
          {#if step.purpose}
            <span class="bds-dr-step-purpose">- {step.purpose}</span>
          {/if}
        </div>
      {/each}
    </div>

    <div class="bds-dr-actions">
      <button class="bds-dr-btn bds-dr-btn-approve" onclick={handleApprove} data-testid="dr-approve-btn">
        Approve
      </button>
      <button class="bds-dr-btn bds-dr-btn-revise" onclick={handleRequestChanges} data-testid="dr-revise-btn">
        Request Changes
      </button>
      <button class="bds-dr-btn bds-dr-btn-cancel" onclick={handleCancel} data-testid="dr-cancel-btn">
        Cancel
      </button>
    </div>

    {#if showFeedback}
      <div class="bds-dr-feedback">
        <textarea
          class="bds-dr-feedback-input"
          placeholder="Describe what changes you want in the research plan..."
          bind:value={feedbackText}
          data-testid="dr-feedback-input"
        ></textarea>
        <button class="bds-dr-btn bds-dr-btn-submit" onclick={handleRequestChanges} data-testid="dr-submit-feedback-btn">
          Submit Feedback
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .bds-deep-research-plan-card {
    border: 1px solid var(--bds-border, #3a3b3f);
    border-radius: 8px;
    padding: 12px;
    margin: 8px 0;
    background: var(--bds-bg-panel, #1e1f23);
    font-size: 14px;
  }
  .bds-dr-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .bds-dr-icon {
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
  .bds-dr-title { font-weight: 600; flex: 1; color: var(--bds-text-primary, #ececec); }
  .bds-dr-run-id { font-size: 11px; opacity: 0.6; font-family: monospace; }
  .bds-dr-steps { margin-bottom: 12px; }
  .bds-dr-step {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 4px 0;
    flex-wrap: wrap;
  }
  .bds-dr-step-num { font-weight: 600; min-width: 20px; }
  .bds-dr-step-action {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 500;
    background: var(--bds-bg-hover, rgba(255, 255, 255, 0.08));
  }
  .bds-dr-step-action.search { color: #1976d2; }
  .bds-dr-step-action.fetch { color: #2e7d32; }
  .bds-dr-step-query {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .bds-dr-step-purpose { font-size: 12px; opacity: 0.7; }
  .bds-dr-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .bds-dr-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--bds-border, #3a3b3f);
    cursor: pointer;
    font-size: 13px;
    color: var(--bds-text-primary, #ececec);
    background: var(--bds-bg-elevated, #25262b);
  }
  .bds-dr-btn:hover { background: var(--bds-bg-hover, rgba(255, 255, 255, 0.08)); }
  .bds-dr-btn-approve { border-color: rgba(46, 125, 50, 0.5); }
  .bds-dr-btn-revise { border-color: rgba(245, 158, 11, 0.5); }
  .bds-dr-btn-cancel { border-color: rgba(211, 47, 47, 0.5); }
  .bds-dr-feedback {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bds-dr-feedback-input {
    width: 100%;
    min-height: 64px;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--bds-border, #3a3b3f);
    font-size: 13px;
    resize: vertical;
    color: var(--bds-text-primary, #ececec);
    background: var(--bds-bg-elevated, #25262b);
    box-sizing: border-box;
  }
  .bds-dr-btn-submit { align-self: flex-end; }
  .bds-dr-error { color: #d32f2f; }
  .bds-dr-error-detail,
  .bds-dr-raw {
    font-size: 11px;
    overflow-x: auto;
    background: var(--bds-bg-elevated, #25262b);
    padding: 6px;
    border-radius: 4px;
    max-height: 120px;
  }
</style>
