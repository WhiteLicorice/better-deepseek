<script>
  import appState from "../state.js";
  import { getFilesForProject, getProjectById } from "../project-manager.js";

  let {
    open = false,
    title = "Project Files",
    confirmLabel = "Confirm",
    initialProjectId = "",
    initialSelectedIds = [],
    onconfirm = () => {},
    oncancel = () => {},
  } = $props();

  let projects = $state([]);
  let projectId = $state("");
  let selectedIds = $state([]);
  let files = $state([]);

  function refresh() {
    projects = [...appState.projects];
    projectId = initialProjectId || appState.activeProjectId || "";
    selectedIds = [...initialSelectedIds];
    syncFiles();
  }

  function syncFiles() {
    files = projectId ? getFilesForProject(projectId) : [];
    const allowedIds = new Set(files.map((file) => file.id));
    selectedIds = selectedIds.filter((id) => allowedIds.has(id));
  }

  $effect(() => {
    if (open) {
      refresh();
    }
  });

  function handleProjectChange(event) {
    projectId = event.target.value;
    syncFiles();
  }

  function handleFileToggle(fileId, checked) {
    if (checked) {
      selectedIds = [...selectedIds, fileId];
      return;
    }
    selectedIds = selectedIds.filter((id) => id !== fileId);
  }

  function toggleAll() {
    if (selectedIds.length === files.length) {
      selectedIds = [];
      return;
    }
    selectedIds = files.map((file) => file.id);
  }

  function confirmSelection() {
    const project = getProjectById(projectId);
    onconfirm({
      projectId,
      project,
      fileIds: [...selectedIds],
      files: files.filter((file) => selectedIds.includes(file.id)),
    });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  let selectedSize = $derived(
    files
      .filter((file) => selectedIds.includes(file.id))
      .reduce((sum, file) => sum + file.size, 0)
  );

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      oncancel();
    }
  }

  function handleModalKeydown(event) {
    if (event.key === "Escape") {
      oncancel();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="bds-project-modal-overlay" onclick={handleOverlayClick}>
      <div class="bds-project-modal" role="dialog" aria-modal="true" aria-labelledby="bds-project-modal-title" tabindex="-1" onkeydown={handleModalKeydown}>
        <div class="bds-project-modal-header">
          <div>
            <div id="bds-project-modal-title" class="bds-project-modal-title">{title}</div>
            <div class="bds-project-modal-subtitle">Choose a project and the files to work with.</div>
          </div>
        <button type="button" class="bds-project-modal-close" onclick={oncancel} aria-label="Close">×</button>
      </div>

      <div class="bds-project-modal-body">
        <label class="bds-label" for="bds-project-modal-select">Project</label>
        <select id="bds-project-modal-select" class="bds-select" value={projectId} onchange={handleProjectChange}>
          <option value="">Select a project</option>
          {#each projects as project (project.id)}
            <option value={project.id}>{project.name}</option>
          {/each}
        </select>

        {#if projectId && files.length > 0}
          <div class="bds-project-modal-summary">
            <button type="button" class="bds-btn-outlined" style="font-size: 11px; padding: 3px 8px;" onclick={toggleAll}>
              {selectedIds.length === files.length ? "Clear All" : "Select All"}
            </button>
            <span>{selectedIds.length} selected • {formatSize(selectedSize)}</span>
          </div>

          <div class="bds-project-file-list">
            {#each files as file (file.id)}
              <label class="bds-project-file-row">
                <input type="checkbox" checked={selectedIds.includes(file.id)} onchange={(event) => handleFileToggle(file.id, event.target.checked)} />
                <span class="bds-project-file-copy">
                  <span class="bds-project-file-name">{file.name}</span>
                  <span class="bds-project-file-meta">{formatSize(file.size)}</span>
                </span>
              </label>
            {/each}
          </div>
        {:else if projectId}
          <p class="bds-empty" style="font-size: 11px; margin: 8px 0 0;">This project has no files yet.</p>
        {:else}
          <p class="bds-empty" style="font-size: 11px; margin: 8px 0 0;">Select a project to continue.</p>
        {/if}
      </div>

      <div class="bds-project-modal-footer">
        <button type="button" class="bds-btn-outlined" onclick={oncancel}>Cancel</button>
        <button type="button" class="bds-btn" onclick={confirmSelection} disabled={!projectId || selectedIds.length === 0}>{confirmLabel}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bds-project-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
    background: rgba(10, 14, 26, 0.42);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .bds-project-modal {
    width: min(560px, 100%);
    max-height: min(80vh, 720px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--bds-surface, #fff);
    color: inherit;
    border: 1px solid var(--bds-border, rgba(0, 0, 0, 0.08));
    border-radius: 16px;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
  }
  .bds-project-modal-header,
  .bds-project-modal-footer {
    padding: 16px 18px;
    border-bottom: 1px solid var(--bds-border, rgba(0, 0, 0, 0.08));
  }
  .bds-project-modal-footer {
    border-bottom: none;
    border-top: 1px solid var(--bds-border, rgba(0, 0, 0, 0.08));
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .bds-project-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .bds-project-modal-title {
    font-size: 16px;
    font-weight: 600;
  }
  .bds-project-modal-subtitle {
    font-size: 12px;
    opacity: 0.65;
    margin-top: 2px;
  }
  .bds-project-modal-close {
    border: none;
    background: transparent;
    color: inherit;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.65;
  }
  .bds-project-modal-body {
    padding: 16px 18px;
    overflow: auto;
  }
  .bds-project-modal-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin: 12px 0 10px;
    font-size: 11px;
    opacity: 0.75;
  }
  .bds-project-file-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bds-project-file-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--bds-border, rgba(0, 0, 0, 0.08));
    border-radius: 12px;
    background: rgba(79, 110, 247, 0.03);
  }
  .bds-project-file-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bds-project-file-name {
    font-size: 12px;
    font-weight: 500;
    word-break: break-word;
  }
  .bds-project-file-meta {
    font-size: 10px;
    opacity: 0.55;
  }
</style>
