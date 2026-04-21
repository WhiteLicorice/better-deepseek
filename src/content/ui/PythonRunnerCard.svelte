<script>
  import { triggerTextDownload } from "../../lib/utils/download.js";
  import { buildPythonRunnerDocument } from "../../lib/utils/html-utils.js";

  /** @type {{content: string}} */
  let { content } = $props();

  let showSource = $state(false);
  let iframeSrcDoc = $derived(buildPythonRunnerDocument(content));

  function handleDownload() {
    triggerTextDownload(content, `script-${Date.now()}.py`);
  }

  function toggleSource() {
    showSource = !showSource;
  }
</script>

<div class="bds-python-card">
  <header class="bds-python-header">
    <div class="bds-python-title">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      <h4>Python Runner</h4>
      <span class="bds-python-badge">Pyodide WASM</span>
    </div>

    <div class="bds-python-actions">
      <button type="button" class="bds-python-btn" onclick={toggleSource}>
        {showSource ? 'Hide Source' : 'Show Source'}
      </button>
      <button type="button" class="bds-python-btn bds-python-btn-primary" onclick={handleDownload}>
        Download .py
      </button>
    </div>
  </header>

  {#if showSource}
    <div class="bds-python-source">
      <pre><code>{content.trim()}</code></pre>
    </div>
  {/if}

  <div class="bds-python-body">
    <iframe
      class="bds-python-frame"
      title="Python Runner"
      sandbox="allow-scripts"
      srcdoc={iframeSrcDoc}
    ></iframe>
  </div>
</div>

<style>
  .bds-python-card {
    margin: 12px 0;
    border: 1px solid var(--bds-border, #d1d5db);
    border-radius: 12px;
    background: var(--bds-bg-panel, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  :global(.dark) .bds-python-card {
    border-color: #374151;
    background: #1f2937;
  }

  .bds-python-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bds-bg-elevated, #f9fafb);
    border-bottom: 1px solid var(--bds-border, #d1d5db);
  }

  :global(.dark) .bds-python-header {
    background: #111827;
    border-bottom-color: #374151;
  }

  .bds-python-title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--bds-text-primary, #111827);
  }

  :global(.dark) .bds-python-title {
    color: #f9fafb;
  }

  .bds-python-title h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .bds-python-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    background: #10b981;
    color: #ffffff;
    border-radius: 999px;
    text-transform: uppercase;
  }

  .bds-python-actions {
    display: flex;
    gap: 8px;
  }

  .bds-python-btn {
    font-size: 11px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--bds-border, #d1d5db);
    background: #ffffff;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  :global(.dark) .bds-python-btn {
    background: #374151;
    border-color: #4b5563;
    color: #f3f4f6;
  }

  .bds-python-btn:hover {
    background: #f3f4f6;
  }

  :global(.dark) .bds-python-btn:hover {
    background: #4b5563;
  }

  .bds-python-btn-primary {
    background: #10b981;
    color: #ffffff;
    border-color: #059669;
  }

  .bds-python-btn-primary:hover {
    background: #059669;
  }

  .bds-python-source {
    padding: 12px;
    background: #0f172a;
    border-bottom: 1px solid #334155;
    max-height: 300px;
    overflow-y: auto;
  }

  .bds-python-source pre {
    margin: 0;
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: 12px;
    color: #e2e8f0;
    white-space: pre-wrap;
  }

  .bds-python-body {
    height: 480px;
    background: #ffffff;
  }

  .bds-python-frame {
    width: 100%;
    height: 100%;
    border: 0;
  }
</style>
