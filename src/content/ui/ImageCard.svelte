<script>
  import { searchImages } from "../../lib/wikimedia-commons.js";
  import { t } from "../../lib/i18n.svelte.js";

  let { content, attrs = {} } = $props();

  let status = $state("idle");
  let imageUrl = $state(null);
  let fullImageUrl = $state(null);
  let fileTitle = $state("");
  let descriptionUrl = $state("");
  let showFullscreen = $state(false);
  let dialogRef = $state(null);

  let query = $derived(
    attrs.src ? "" : (attrs.query || attrs.q || content.trim() || "")
  );

  $effect(() => {
    if (attrs.src) {
      imageUrl = attrs.src;
      fullImageUrl = attrs.src;
      status = "loaded";
      return;
    }
    if (!query) {
      status = "error";
      return;
    }
    status = "loading";
    const controller = new AbortController();
    searchImages({
      query,
      count: attrs.count || 1,
      width: attrs.width || 400,
      filetype: attrs.filetype,
      intitle: attrs.intitle,
      category: attrs.category,
      signal: controller.signal,
    }).then((result) => {
      if (result) {
        imageUrl = result.displayUrl;
        fullImageUrl = result.fullUrl;
        fileTitle = result.title;
        descriptionUrl = result.descriptionUrl;
        status = "loaded";
      } else {
        status = "error";
      }
    }).catch(() => { status = "error"; });

    return () => controller.abort();
  });

  function portal(node) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      },
    };
  }

  function openFullscreen() { showFullscreen = true; }
  function closeFullscreen() { showFullscreen = false; }

  $effect(() => {
    if (dialogRef) dialogRef.focus();
  });

  $effect(() => {
    if (showFullscreen) {
      const handler = (e) => { if (e.key === 'Escape') closeFullscreen(); };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  });
</script>

{#if status === "loading"}
  <div class="bds-image-card bds-image-loading">
    <span class="bds-image-spinner"></span>
    <span class="bds-image-loading-text">{t('imageCard.searching')}</span>
  </div>
{:else if status === "loaded"}
  <div class="bds-image-card">
    <div class="bds-image-wrapper" onclick={openFullscreen}>
      <img
        src={imageUrl}
        alt={attrs.alt || query}
        style={attrs.style}
        loading="lazy"
      />
      {#if attrs.caption || descriptionUrl}
        <div class="bds-image-overlay">
          {#if attrs.caption}
            <span class="bds-image-caption">{attrs.caption}</span>
          {/if}
          {#if descriptionUrl}
            <a
              href={descriptionUrl}
              target="_blank"
              rel="noopener"
              class="bds-image-credit"
            >{fileTitle || "Wikimedia Commons"}</a>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if showFullscreen}
  <div class="bds-image-fullscreen" use:portal onclick={closeFullscreen} role="presentation">
    <div class="bds-image-fullscreen-dialog" bind:this={dialogRef} onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <button class="bds-image-close-btn" onclick={closeFullscreen} aria-label={t('imageCard.close')}>×</button>
      <img src={fullImageUrl || imageUrl} alt={attrs.alt || query} />
    </div>
  </div>
{/if}

<style>
  .bds-image-card {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--bds-border, #3a3b3f);
    background: var(--bds-bg-panel, #1e1f23);
    margin: 10px 0;
    max-width: 100%;
  }

  .bds-image-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px;
    justify-content: center;
  }

  .bds-image-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--bds-border, #3a3b3f);
    border-top-color: var(--bds-accent, #4d6bfe);
    border-radius: 50%;
    animation: bds-spin 0.8s linear infinite;
  }

  @keyframes bds-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .bds-image-loading-text {
    color: var(--bds-text-secondary, #8e8ea0);
    font-size: 13px;
  }

  .bds-image-wrapper {
    position: relative;
    display: block;
    width: 100%;
    max-height: 400px;
    overflow: hidden;
    cursor: pointer;
  }

  .bds-image-wrapper img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 12px;
  }

  .bds-image-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    padding: 30px 12px 8px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 8px;
    pointer-events: none;
  }

  .bds-image-caption {
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .bds-image-credit {
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    text-decoration: none;
    pointer-events: auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bds-image-credit:hover {
    color: #fff;
    text-decoration: underline;
  }

  .bds-image-fullscreen {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    animation: bds-fade-in 0.2s ease-out;
  }

  .bds-image-fullscreen-dialog {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 92vw;
    max-height: 92vh;
    animation: bds-scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .bds-image-fullscreen-dialog img {
    max-width: 92vw;
    max-height: 92vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  }

  .bds-image-close-btn {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    backdrop-filter: blur(4px);
    transition: background 0.15s;
  }

  .bds-image-close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  @keyframes bds-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes bds-scale-in {
    from { transform: scale(0.92); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>
