import state from "./state.js";
import { makeId } from "../lib/utils/helpers.js";

// Files sent before DeepSeek assigns a real conversation id are tracked under
// this temporary draft key and moved once the chat URL resolves.
const DRAFT_CHAT_KEY = "__draft__";
const syntheticFileMetadata = new Map();

export function getTrackedFileSignature(file) {
  return [
    file?.name || "",
    Number(file?.size) || 0,
    Number(file?.lastModified) || 0,
  ].join("::");
}

export function registerSyntheticFiles(files, metadataList) {
  files.forEach((file, index) => {
    syntheticFileMetadata.set(getTrackedFileSignature(file), {
      ...(metadataList[index] || {}),
      name: file.name,
      size: file.size,
    });
  });
}

export function captureComposerFiles(nativeInput) {
  state.pendingComposerFiles = readInputFiles(nativeInput);
  refreshSentFilesUi();
  return state.pendingComposerFiles;
}

export function queuePendingSendFromComposer(nativeInput) {
  const files = captureComposerFiles(nativeInput);
  state.pendingSendFiles = files;
  return files;
}

export function commitPendingSend(conversationId = null) {
  const files = Array.isArray(state.pendingSendFiles) ? state.pendingSendFiles : [];
  if (!files.length) {
    return;
  }

  const key = resolveChatKey(conversationId);
  const nextEntry = {
    id: makeId(),
    sentAt: Date.now(),
    files,
  };

  state.chatSentFiles = {
    ...state.chatSentFiles,
    [key]: [...(state.chatSentFiles[key] || []), nextEntry],
  };
  state.pendingSendFiles = [];
  state.pendingComposerFiles = [];
  refreshSentFilesUi();
}

export function clearPendingSend() {
  state.pendingSendFiles = [];
  state.pendingComposerFiles = [];
  refreshSentFilesUi();
}

export function getSentFileEntries(conversationId = null) {
  return state.chatSentFiles[resolveChatKey(conversationId)] || [];
}

export function moveDraftSentFilesToConversation(conversationId) {
  const draftEntries = state.chatSentFiles[DRAFT_CHAT_KEY];
  if (!conversationId || !Array.isArray(draftEntries) || draftEntries.length === 0) {
    return;
  }

  state.chatSentFiles = {
    ...state.chatSentFiles,
    [conversationId]: [...(state.chatSentFiles[conversationId] || []), ...draftEntries],
  };
  delete state.chatSentFiles[DRAFT_CHAT_KEY];
  refreshSentFilesUi();
}

function readInputFiles(nativeInput) {
  return Array.from(nativeInput?.files || []).map((file) => {
    const signature = getTrackedFileSignature(file);
    const syntheticMeta = syntheticFileMetadata.get(signature);
    const base = {
      name: file.name,
      size: file.size,
      source: syntheticMeta?.source || "upload",
      kind: syntheticMeta?.kind || "upload",
    };

    if (!syntheticMeta) {
      return base;
    }

    return {
      ...base,
      projectId: syntheticMeta.projectId || null,
      projectName: syntheticMeta.projectName || null,
      projectFileIds: syntheticMeta.projectFileIds || [],
      projectFiles: syntheticMeta.projectFiles || [],
    };
  });
}

function resolveChatKey(conversationId) {
  return String(conversationId || state.currentConversationId || DRAFT_CHAT_KEY);
}

function refreshSentFilesUi() {
  if (state.ui && typeof state.ui.refreshSentFiles === "function") {
    state.ui.refreshSentFiles();
  }
}
