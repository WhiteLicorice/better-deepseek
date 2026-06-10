<script>
  import { onMount } from "svelte";

  let { enabled = false, onToggle = null } = $props();
  let localEnabled = $state(false);

  $effect(() => {
    localEnabled = Boolean(enabled);
  });

  onMount(() => {
    const handler = (event) => {
      localEnabled = Boolean(event.detail?.enabled);
    };
    window.addEventListener("bds:deep-research-toggle-state", handler);
    return () => window.removeEventListener("bds:deep-research-toggle-state", handler);
  });

  function handleToggle() {
    localEnabled = !localEnabled;
    if (onToggle) onToggle(localEnabled);
  }
</script>

<button
  class="bds-deep-research-toggle"
  class:active={localEnabled}
  onclick={handleToggle}
  title={localEnabled ? "Deep Research Mode ON" : "Enable Deep Research Mode"}
  data-testid="deep-research-toggle"
>
  <span class="bds-drt-icon">DR</span>
  <span class="bds-drt-label">{localEnabled ? "Research ON" : "Research"}</span>
</button>

<style>
  .bds-deep-research-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 16px;
    border: 1px solid var(--bds-border, #ddd);
    background: var(--bds-card-bg, #fff);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
  }
  .bds-deep-research-toggle:hover {
    border-color: #90caf9;
    background: #e3f2fd;
  }
  .bds-deep-research-toggle.active {
    border-color: #42a5f5;
    background: #bbdefb;
    font-weight: 600;
  }
  .bds-drt-icon { font-size: 11px; font-weight: 700; }
  .bds-drt-label { white-space: nowrap; }
</style>
