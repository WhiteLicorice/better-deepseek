<script>
import VisualizerCard from "./VisualizerCard.svelte";
  import ToolCard from "./ToolCard.svelte";
  import PptxCard from "./PptxCard.svelte";
  import ExcelCard from "./ExcelCard.svelte";
  import DocxCard from "./DocxCard.svelte";
  import LoadingIndicator from "./LoadingIndicator.svelte";


  /** 
   * @typedef {object} ToolBlock
   * @property {string} name
   * @property {string} content
   * @property {object} attrs
   */

  /** @type {{
   *   text: string, 
   *   blocks: ToolBlock[],
   *   loading?: boolean
   * }} */
  let { text, blocks = [], loading = false, loadingIndex = 1 } = $props();
</script>

<div class="bds-message-overlay">
  <!-- TEXT -->
  {#if text && text.trim()}
    <div class="bds-sanitized-text">
      {text}
    </div>
  {/if}

  <!-- TOOLS BELOW TEXT -->
  <div class="bds-tool-blocks">
    {#each blocks as block}
      {#if block.name === 'visualizer'}
        <VisualizerCard content={block.content} />
      {:else if block.name === 'pptx'}
        <PptxCard content={block.content} />
      {:else if block.name === 'excel'}
        <ExcelCard content={block.content} />
      {:else if block.name === 'docx'}
        <DocxCard content={block.content} />
      {:else if block.name === 'ask_question'}
        <div class="bds-question-info-card">
          <div class="bds-question-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="bds-question-content">
            <div class="bds-question-title">Clarifying questions asked.</div>
            <div class="bds-question-subtitle">Please provide your answers in the interaction panel below.</div>
          </div>
        </div>
      {:else}
        <ToolCard name={block.name} content={block.content} />
      {/if}
    {/each}
  </div>

  <!-- LOADING INDICATOR AT THE BOTTOM -->
  {#if loading}
    <div class="bds-loading-wrapper">
      <LoadingIndicator index={loadingIndex} />
    </div>
  {/if}
</div>

<style>
  .bds-question-info-card {
    background: var(--bds-bg-panel, #1e1f23);
    border: 1px solid var(--bds-border, #3a3b3f);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 10px 0;
  }

  .bds-question-icon {
    font-size: 20px;
    background: var(--bds-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--bds-accent, #5b7bff);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .bds-question-title {
    font-weight: 600;
    font-size: 15px;
    color: var(--bds-text-primary, #ececec);
  }

  .bds-question-subtitle {
    font-size: 13px;
    color: var(--bds-text-secondary, #8e8ea0);
    margin-top: 2px;
  }

  .bds-message-overlay {
    margin-top: 10px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: inherit;
    color: #333; 
  }

  .bds-sanitized-text {
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    color: inherit;
    background: transparent;
  }

  /* DeepSeek color sync */
  :global(.dark) .bds-message-overlay {
    color: #ececec;
  }


</style>
