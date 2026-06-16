<script>
  import { marked } from "marked";
  import { triggerBlobDownload } from "../../lib/utils/download.js";

  let { runId = "", markdown = "" } = $props();
  let normalizedMarkdown = $derived(stripLeadingBlankLines(markdown));

  let renderedHtml = $derived.by(() => {
    try {
      return marked(normalizedMarkdown || "");
    } catch {
      return normalizedMarkdown || "";
    }
  });

  let collapsed = $state(false);

  function toggleCollapse() {
    collapsed = !collapsed;
  }

  function buildReportFileName() {
    const suffix = String(runId || Date.now())
      .slice(0, 36)
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    return `deep-research-${suffix || "report"}.md`;
  }

  function downloadMarkdown(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const blob = new Blob([normalizedMarkdown], { type: "text/markdown" });
    triggerBlobDownload(blob, buildReportFileName());
  }

  function stripLeadingBlankLines(content) {
    return String(content || "").replace(/^(?:[ \t]*\r?\n)+/, "");
  }
</script>

<div class="bds-deep-research-report-card" data-testid="deep-research-report-card">
  <div class="bds-drr-header">
    <span class="bds-drr-icon">DR</span>
    <span class="bds-drr-title">Deep Research Report</span>
    {#if runId}
      <span class="bds-drr-run-id">Run: {runId.slice(0, 8)}</span>
    {/if}
    <button type="button" class="bds-drr-toggle" onclick={downloadMarkdown} data-testid="deep-research-download-btn">
      Download .md
    </button>
    <button type="button" class="bds-drr-toggle" onclick={toggleCollapse}>
      {collapsed ? "Show" : "Hide"}
    </button>
  </div>

  {#if !collapsed}
    <div class="bds-drr-content">
      {@html renderedHtml}
    </div>
  {/if}
</div>

<style>
  .bds-deep-research-report-card {
    margin: 8px 0;
    border: 1px solid var(--bds-border, #3a3b3f);
    border-radius: 12px;
    background: var(--bds-bg-panel, #1e1f23);
    color: var(--bds-text-primary, #ececec);
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .bds-drr-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
  }
  .bds-drr-icon {
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
  .bds-drr-title {
    font-size: 13px;
    font-weight: 600;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bds-drr-run-id {
    font-size: 10.5px;
    color: var(--bds-text-tertiary, rgba(255, 255, 255, 0.5));
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    flex-shrink: 0;
  }
  .bds-drr-toggle {
    font-size: 12px;
    background: var(--bds-bg-elevated, #25262b);
    border: 1px solid var(--bds-border, #3a3b3f);
    border-radius: 8px;
    padding: 4px 9px;
    cursor: pointer;
    color: var(--bds-text-primary, #ececec);
    flex-shrink: 0;
  }
  .bds-drr-toggle:hover {
    background: var(--bds-bg-hover, rgba(255, 255, 255, 0.08));
  }
  .bds-drr-content {
    padding: 12px 14px;
    border-top: 1px solid var(--bds-border, #3a3b3f);
    line-height: 1.6;
    color: var(--bds-text-secondary, rgba(255, 255, 255, 0.7));
  }
  .bds-drr-content :global(h1),
  .bds-drr-content :global(h2),
  .bds-drr-content :global(h3) {
    margin-top: 16px;
    margin-bottom: 8px;
  }
  .bds-drr-content :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
  }
  .bds-drr-content :global(th),
  .bds-drr-content :global(td) {
    border: 1px solid var(--bds-border, #3a3b3f);
    padding: 6px 10px;
    text-align: left;
  }
  .bds-drr-content :global(a) {
    color: #1976d2;
    text-decoration: underline;
  }
  @media (max-width: 560px) {
    .bds-drr-title {
      display: none;
    }
  }
</style>
