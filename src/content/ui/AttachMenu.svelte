<script>
  import { onMount } from "svelte";
  import { pickFolderAndConcatenate } from "../files/folder-reader.js";

  // The native input[type="file"] reference passed from scanner
  export let nativeInput;

  let isOpen = false;
  let menuRef;
  let dropdownRef;
  let dropdownStyle = "";

  function toggleMenu(e) {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      isOpen = true;
    } else {
      isOpen = false;
    }
  }

  function updatePosition() {
    if (!menuRef) return;
    const rect = menuRef.getBoundingClientRect();
    // Position fixed to avoid overflow:hidden clipping
    // Show above the button and aligned to the right since it's on the right side
    dropdownStyle = `bottom: calc(100vh - ${rect.top}px + 8px); right: calc(100vw - ${rect.right}px);`;
  }

  function portal(node) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }

  function closeMenu() {
    isOpen = false;
  }

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  });

  function handleClickOutside(e) {
    if (menuRef && !menuRef.contains(e.target)) {
      closeMenu();
    }
  }

  function handleUploadFile() {
    closeMenu();
    if (nativeInput) {
      nativeInput.click();
    }
  }

  async function handleUploadFolder() {
    closeMenu();
    if (!nativeInput) return;

    const fakeFile = await pickFolderAndConcatenate();
    if (fakeFile) {
      const dt = new DataTransfer();

      // Preserve any existing files DeepSeek might have already staged 
      // (though DeepSeek usually reads them and clears the input, but just in case)
      if (nativeInput.files) {
        for (let i = 0; i < nativeInput.files.length; i++) {
          dt.items.add(nativeInput.files[i]);
        }
      }
      
      dt.items.add(fakeFile);
      
      // Assign and trigger change event
      nativeInput.files = dt.files;
      const event = new Event("change", { bubbles: true });
      nativeInput.dispatchEvent(event);
    }
  }
</script>

<div class="bds-attach-wrapper" bind:this={menuRef}>
  <button class="bds-plus-btn" on:click={toggleMenu} title="Gelişmiş Yükleme">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  </button>
  
  {#if isOpen}
    <div class="bds-attach-dropdown" style={dropdownStyle} use:portal on:click|stopPropagation>
      <button class="bds-attach-item" on:click={handleUploadFile}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bds-item-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        Dosya Yükle
      </button>
      <button class="bds-attach-item" on:click={handleUploadFolder}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bds-item-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
        Klasör Yükle
      </button>
    </div>
  {/if}
</div>

<style>
  .bds-attach-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 6px;
  }

  .bds-plus-btn {
    background: transparent;
    border: none;
    color: var(--dsw-alias-brand-text, #4d6bfe);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.1s ease;
  }

  .bds-plus-btn:hover {
    background-color: var(--dsw-alias-brand-hover-bg, rgba(77, 107, 254, 0.1));
  }

  .bds-plus-btn:active {
    transform: scale(0.95);
  }

  .bds-attach-dropdown {
    position: fixed;
    background: var(--dsw-color-bg-elevated, #2a2a2a);
    border: 1px solid var(--dsw-color-border-primary, #3d3d3d);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    padding: 6px;
    display: flex;
    flex-direction: column;
    min-width: 150px;
    z-index: 999999;
  }

  .bds-attach-item {
    background: none;
    border: none;
    color: var(--dsw-alias-text, #e0e0e0);
    padding: 10px 12px;
    text-align: left;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .bds-attach-item:hover {
    background: var(--dsw-color-bg-hover, #3d3d3d);
    color: var(--dsw-alias-brand-text, #ffffff);
  }

  .bds-item-icon {
    opacity: 0.8;
  }

  @media (prefers-color-scheme: light) {
    .bds-attach-dropdown {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }
  }
</style>
