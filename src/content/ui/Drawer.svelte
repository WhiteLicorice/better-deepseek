<script>
  import SettingsPanel from "./SettingsPanel.svelte";
  import SkillList from "./SkillList.svelte";
  import MemoryList from "./MemoryList.svelte";

  let { open = false, onclose } = $props();

  let settingsRef = $state(null);
  let skillsRef = $state(null);
  let memoryRef = $state(null);

  export function refreshSettings() {
    if (settingsRef) settingsRef.refresh();
  }
  export function refreshSkills() {
    if (skillsRef) skillsRef.refresh();
  }
  export function refreshMemories() {
    if (memoryRef) memoryRef.refresh();
  }
</script>

<aside id="bds-drawer" class={open ? "bds-open" : "bds-closed"}>
  <div class="bds-drawer-header">
    <div class="ds-modal-content__title">Better DeepSeek</div>
    <button id="bds-close" type="button" onclick={onclose} aria-label="Close">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.1871 13.1265L13.1265 14.1872L1.81275 2.87347L2.87341 1.81281L14.1871 13.1265Z" fill="currentColor"></path>
        <path d="M13.1265 1.81282L14.1871 2.87348L2.8734 14.1872L1.81274 13.1265L13.1265 1.81282Z" fill="currentColor"></path>
      </svg>
    </button>
  </div>

  <SettingsPanel bind:this={settingsRef} />

  <hr />

  <SkillList bind:this={skillsRef} />

  <hr />

  <MemoryList bind:this={memoryRef} />
</aside>
