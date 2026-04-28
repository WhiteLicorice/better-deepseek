<script>
  import appState from "../state.js";
  import ProjectFilePickerModal from "./ProjectFilePickerModal.svelte";
  import {
    clearActiveProject,
    getActiveProject,
    getCurrentConversationId,
    getFilesForProject,
    getProjectForConversation,
    setActiveFiles,
    setActiveProject,
  } from "../project-manager.js";
  import { collectMessageNodes } from "../scanner.js";
  import { pushConfigToPage } from "../bridge.js";

  let projects = $state([]);
  let activeProject = $state(null);
  let conversationProject = $state(null);
  let selectedFiles = $state([]);
  let selectedId = $state("");
  let pendingId = $state("");
  let showConfirm = $state(false);
  let showFileModal = $state(false);

  export function refreshProjectState() {
    projects = [...appState.projects];
    activeProject = getActiveProject();
    selectedId = activeProject?.id || "";
    conversationProject = getProjectForConversation(getCurrentConversationId());
    selectedFiles = activeProject ? getFilesForProject(activeProject.id).filter((file) => appState.activeFileIds.includes(file.id)) : [];
  }

  $effect(() => {
    refreshProjectState();
  });

  function hasMessages() {
    return collectMessageNodes().some((node) => !node.closest("#bds-root"));
  }

  function handleProjectChange(event) {
    const nextId = event.target.value;
    if (hasMessages()) {
      pendingId = nextId;
      showConfirm = true;
      event.target.value = selectedId;
      return;
    }
    applySwitch(nextId);
  }

  function applySwitch(projectId) {
    if (projectId) {
      setActiveProject(projectId);
    } else {
      clearActiveProject();
    }
    refreshProjectState();
    pushConfigToPage();
    if (appState.ui) {
      appState.ui.refreshProjects();
    }
  }

  function confirmSwitch() {
    applySwitch(pendingId);
    pendingId = "";
    showConfirm = false;
  }

  function cancelSwitch() {
    pendingId = "";
    showConfirm = false;
  }

  function handleFileSelection(detail) {
    setActiveFiles(detail.fileIds);
    showFileModal = false;
    refreshProjectState();
    pushConfigToPage();
    if (appState.ui) {
      appState.ui.refreshProjects();
      appState.ui.showToast(
        detail.fileIds.length
          ? `${detail.fileIds.length} project file${detail.fileIds.length === 1 ? "" : "s"} ready for the next chat send.`
          : "Project file selection cleared."
      );
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  let selectedSize = $derived(selectedFiles.reduce((sum, file) => sum + file.size, 0));
</script>

<div class="bds-hero-project-bar">
  <div class="bds-hero-project-topline">
    <div class="bds-hero-project-copy">
      <span class="bds-hero-project-label">Project Context</span>
      {#if conversationProject}
        <span class="bds-hero-project-associated">This chat is linked to <strong>{conversationProject.name}</strong>.</span>
      {:else}
        <span class="bds-hero-project-associated">Choose the project and project files you want available on the next new-chat send.</span>
      {/if}
    </div>
  </div>

  <div class="bds-hero-project-controls">
    <select class="bds-select bds-hero-project-select" value={selectedId} onchange={handleProjectChange}>
      <option value="">No active project</option>
      {#each projects as project (project.id)}
        <option value={project.id}>{project.name}</option>
      {/each}
    </select>

    <button type="button" class="bds-btn-outlined" onclick={() => (showFileModal = true)} disabled={!activeProject}>
      {selectedFiles.length ? `Choose Files (${selectedFiles.length})` : "Choose Files"}
    </button>
  </div>

  {#if activeProject}
    <div class="bds-hero-project-summary">
      <div>
        <strong>{activeProject.name}</strong>
        {#if activeProject.description}
          <span class="bds-hero-project-description">{activeProject.description}</span>
        {/if}
      </div>
      <span>{selectedFiles.length} selected • {formatSize(selectedSize)}</span>
    </div>
  {/if}

  {#if selectedFiles.length > 0}
    <div class="bds-hero-project-chips">
      {#each selectedFiles as file (file.id)}
        <span class="bds-hero-project-chip">{file.name}</span>
      {/each}
    </div>
  {/if}

  {#if showConfirm}
    <div class="bds-confirm-box" style="margin-top: 8px;">
      <p class="bds-confirm-text">
        Project context applies to new conversations. Switch now to change what future chats inherit.
      </p>
      <div class="bds-editor-actions">
        <button type="button" class="bds-btn-outlined" onclick={cancelSwitch}>Cancel</button>
        <button type="button" class="bds-btn" onclick={confirmSwitch}>Switch</button>
      </div>
    </div>
  {/if}
</div>

<ProjectFilePickerModal
  open={showFileModal}
  title="Choose Project Files"
  confirmLabel="Save Selection"
  initialProjectId={activeProject?.id || ""}
  initialSelectedIds={appState.activeFileIds}
  oncancel={() => (showFileModal = false)}
  onconfirm={handleFileSelection}
/>

<style>
  .bds-hero-project-bar {
    margin-top: 10px;
    padding: 12px 14px;
    border: 1px solid rgba(77, 107, 254, 0.14);
    border-radius: 16px;
    background: rgba(77, 107, 254, 0.04);
    color: inherit;
  }
  .bds-hero-project-topline,
  .bds-hero-project-controls,
  .bds-hero-project-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .bds-hero-project-controls {
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .bds-hero-project-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .bds-hero-project-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.55;
    font-weight: 600;
  }
  .bds-hero-project-associated,
  .bds-hero-project-description,
  .bds-hero-project-summary {
    font-size: 12px;
    opacity: 0.72;
  }
  .bds-hero-project-select {
    min-width: min(280px, 100%);
    flex: 1;
  }
  .bds-hero-project-summary {
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .bds-hero-project-description {
    display: block;
    margin-top: 2px;
  }
  .bds-hero-project-chips {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .bds-hero-project-chip {
    max-width: 100%;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(77, 107, 254, 0.1);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
