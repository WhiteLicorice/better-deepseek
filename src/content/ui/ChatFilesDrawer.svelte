<script>
  import { getCurrentConversationId } from "../project-manager.js";
  import { getSentFileEntries } from "../chat-file-tracker.js";

  let open = $state(false);
  let entries = $state([]);
  let conversationId = $state(null);

  export function refreshSentFiles() {
    conversationId = getCurrentConversationId();
    entries = getSentFileEntries(conversationId);
  }

  $effect(() => {
    refreshSentFiles();
  });

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  let totalFiles = $derived(entries.reduce((sum, entry) => sum + entry.files.length, 0));
</script>

<aside class:open class="bds-chat-files-drawer">
  <button type="button" class="bds-chat-files-toggle" onclick={() => (open = !open)} aria-expanded={open} aria-label={open ? "Collapse sent files drawer" : "Expand sent files drawer"}>
    <span>{open ? "Hide" : "Files"}</span>
    <span class="bds-chat-files-count">{totalFiles}</span>
  </button>

  <div class="bds-chat-files-panel">
    <div class="bds-chat-files-header">
      <div>
        <div class="bds-chat-files-title">Sent Files</div>
        <div class="bds-chat-files-subtitle">{conversationId ? "Current chat" : "Draft chat"}</div>
      </div>
    </div>

    {#if entries.length === 0}
      <p class="bds-chat-files-empty">Files you send in this chat will appear here.</p>
    {:else}
      <div class="bds-chat-files-list">
        {#each entries as entry (entry.id)}
          <section class="bds-chat-files-entry">
            <div class="bds-chat-files-entry-head">
              <span>Sent {formatTime(entry.sentAt)}</span>
              <span>{entry.files.length} file{entry.files.length === 1 ? "" : "s"}</span>
            </div>

            <div class="bds-chat-files-entry-body">
              {#each entry.files as file, index (`${entry.id}-${index}-${file.name}`)}
                <div class="bds-chat-file-row">
                  <div class="bds-chat-file-main">
                    <div class="bds-chat-file-name">{file.name}</div>
                    <div class="bds-chat-file-meta">
                      {file.source === "project" ? `${file.projectName || "Project"} • ` : ""}{formatSize(file.size)}
                    </div>
                  </div>
                  {#if file.projectFiles?.length}
                    <div class="bds-chat-file-badge">{file.projectFiles.length} project file{file.projectFiles.length === 1 ? "" : "s"}</div>
                  {/if}
                </div>
                {#if file.projectFiles?.length}
                  <div class="bds-chat-file-nested-list">
                    {#each file.projectFiles as projectFile (`${entry.id}-${file.name}-${projectFile.id || projectFile.name}`)}
                      <div class="bds-chat-file-nested-item">{projectFile.name}</div>
                    {/each}
                  </div>
                {/if}
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {/if}
  </div>
</aside>

<style>
  .bds-chat-files-drawer {
    position: fixed;
    top: 50%;
    right: 0;
    transform: translateY(-50%);
    z-index: 2147483640;
    display: flex;
    align-items: stretch;
    pointer-events: none;
  }
  .bds-chat-files-toggle,
  .bds-chat-files-panel {
    pointer-events: auto;
  }
  .bds-chat-files-toggle {
    border: 1px solid rgba(77, 107, 254, 0.16);
    border-right: none;
    border-radius: 12px 0 0 12px;
    background: var(--bds-surface, rgba(255, 255, 255, 0.96));
    color: inherit;
    padding: 12px 10px;
    min-width: 56px;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
    cursor: pointer;
  }
  .bds-chat-files-count,
  .bds-chat-file-badge {
    border-radius: 999px;
    background: rgba(77, 107, 254, 0.12);
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 600;
  }
  .bds-chat-files-panel {
    width: 0;
    overflow: hidden;
    opacity: 0;
    transition: width 0.2s ease, opacity 0.2s ease;
    background: var(--bds-surface, rgba(255, 255, 255, 0.97));
    border: 1px solid rgba(77, 107, 254, 0.16);
    border-right: none;
    border-radius: 16px 0 0 16px;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
  }
  .bds-chat-files-drawer.open .bds-chat-files-panel {
    width: min(360px, calc(100vw - 72px));
    opacity: 1;
  }
  .bds-chat-files-header {
    padding: 16px 16px 10px;
    border-bottom: 1px solid var(--bds-border, rgba(0, 0, 0, 0.08));
  }
  .bds-chat-files-title {
    font-size: 14px;
    font-weight: 600;
  }
  .bds-chat-files-subtitle,
  .bds-chat-file-meta,
  .bds-chat-files-entry-head {
    font-size: 11px;
    opacity: 0.6;
  }
  .bds-chat-files-empty {
    padding: 16px;
    margin: 0;
    font-size: 12px;
    opacity: 0.68;
  }
  .bds-chat-files-list {
    max-height: min(70vh, 720px);
    overflow: auto;
    padding: 12px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bds-chat-files-entry {
    border: 1px solid var(--bds-border, rgba(0, 0, 0, 0.08));
    border-radius: 14px;
    padding: 12px;
    background: rgba(77, 107, 254, 0.03);
  }
  .bds-chat-files-entry-head,
  .bds-chat-file-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  .bds-chat-files-entry-head {
    margin-bottom: 10px;
  }
  .bds-chat-files-entry-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bds-chat-file-main {
    min-width: 0;
  }
  .bds-chat-file-name {
    font-size: 12px;
    font-weight: 500;
    word-break: break-word;
  }
  .bds-chat-file-nested-list {
    margin-left: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .bds-chat-file-nested-item {
    font-size: 11px;
    opacity: 0.78;
    word-break: break-word;
  }
</style>
