// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const folderMocks = vi.hoisted(() => ({
  pickFolderAndConcatenate: vi.fn(),
}));

const githubMocks = vi.hoisted(() => ({
  fetchGitHubRepo: vi.fn(),
  parseGitHubUrl: vi.fn(),
}));

const webMocks = vi.hoisted(() => ({
  fetchAndConvertWebPage: vi.fn(),
  isWebFetchPermissionError: vi.fn((error) =>
    Boolean(error && error.bdsWebFetchPermissionError),
  ),
}));

const projectFileBuilderMocks = vi.hoisted(() => ({
  projectFilesToFile: vi.fn(),
}));

const projectManagerMocks = vi.hoisted(() => ({
  getFilesForProject: vi.fn(),
  setActiveProject: vi.fn(),
  clearActiveProject: vi.fn(),
  tickFile: vi.fn(),
  untickFile: vi.fn(),
  clearActiveFiles: vi.fn(),
}));

const bridgeMocks = vi.hoisted(() => ({
  pushConfigToPage: vi.fn(),
}));

vi.mock("../../../src/content/files/folder-reader.js", () => folderMocks);
vi.mock("../../../src/content/files/github-reader.js", () => githubMocks);
vi.mock("../../../src/content/files/web-reader.js", () => webMocks);
vi.mock("../../../src/content/files/project-file-builder.js", () => projectFileBuilderMocks);
vi.mock("../../../src/content/project-manager.js", () => projectManagerMocks);
vi.mock("../../../src/content/bridge.js", () => bridgeMocks);

import AttachMenu from "../../../src/content/ui/AttachMenu.svelte";
import state from "../../../src/content/state.js";
import { resetAppState } from "../../helpers/app-state.js";
import { renderSvelte, flushUi } from "../../helpers/svelte.js";

function setupNativeInput() {
  const nativeInput = document.createElement("input");
  nativeInput.type = "file";
  nativeInput.multiple = true;
  Object.defineProperty(nativeInput, "files", {
    configurable: true,
    writable: true,
    value: [],
  });
  nativeInput.click = vi.fn();
  document.body.appendChild(nativeInput);
  return nativeInput;
}

describe("AttachMenu integration", () => {
  beforeEach(() => {
    resetAppState({
      ui: { showToast: vi.fn() },
    });
    state.projects = [{ id: "p1", name: "Project One" }];
    state.activeProjectId = "p1";
    state.activeFileIds = ["f1"];
    projectManagerMocks.getFilesForProject.mockReset();
    projectManagerMocks.getFilesForProject.mockReturnValue([
      { id: "f1", name: "README.md", content: "# Demo" },
    ]);
    projectManagerMocks.setActiveProject.mockReset();
    projectManagerMocks.clearActiveProject.mockReset();
    projectManagerMocks.tickFile.mockReset();
    projectManagerMocks.untickFile.mockReset();
    githubMocks.fetchGitHubRepo.mockReset();
    githubMocks.parseGitHubUrl.mockReset();
    webMocks.fetchAndConvertWebPage.mockReset();
    webMocks.isWebFetchPermissionError.mockImplementation((error) =>
      Boolean(error && error.bdsWebFetchPermissionError),
    );
    projectFileBuilderMocks.projectFilesToFile.mockReset();
    bridgeMocks.pushConfigToPage.mockReset();
    document.body.innerHTML = '<textarea id="chat-input"></textarea><button aria-label="Send"></button>';
    document.querySelector("button").click = vi.fn();
  });

  it("opens the dropdown and triggers native file upload", async () => {
    const nativeInput = setupNativeInput();
    const { target, cleanup } = renderSvelte(AttachMenu, { nativeInput });

    target.querySelector(".bds-plus-btn").click();
    await flushUi();
    document.querySelector(".bds-attach-item").click();

    expect(nativeInput.click).toHaveBeenCalledOnce();
    cleanup();
  });

  it("fetches a github repo and injects the resulting file", async () => {
    const nativeInput = setupNativeInput();
    const file = new File(["repo"], "repo.txt", { type: "text/plain" });
    githubMocks.parseGitHubUrl.mockReturnValue({ owner: "owner", repo: "repo", branch: "main" });
    githubMocks.fetchGitHubRepo.mockResolvedValue(file);
    const { target, cleanup } = renderSvelte(AttachMenu, { nativeInput });

    target.querySelector(".bds-plus-btn").click();
    await flushUi();
    const items = Array.from(document.querySelectorAll(".bds-attach-item"));
    items.find((item) => item.textContent.includes("GitHub Repo")).click();
    await flushUi();

    const dialogInput = document.querySelector(".bds-github-input");
    dialogInput.value = "owner/repo";
    dialogInput.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();
    document.querySelector(".bds-github-btn-import").click();
    await flushUi();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(githubMocks.fetchGitHubRepo).toHaveBeenCalledWith(
      "owner/repo",
      expect.any(Function),
      { token: "" },
    );
    expect(nativeInput.files).toHaveLength(1);
    cleanup();
  });

  it("retries web import after the permission dialog grants site access", async () => {
    const nativeInput = setupNativeInput();
    const permissionError = Object.assign(
      new Error("Web Fetch needs permission to access https://example.com."),
      {
        bdsWebFetchPermissionError: true,
        origin: "https://example.com",
      },
    );
    const file = new File(["page"], "page.md", { type: "text/markdown" });
    webMocks.fetchAndConvertWebPage
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValueOnce(file);
    state.ui.requestWebFetchPermission = vi.fn(async () => true);
    const { target, cleanup } = renderSvelte(AttachMenu, { nativeInput });

    target.querySelector(".bds-plus-btn").click();
    await flushUi();
    const items = Array.from(document.querySelectorAll(".bds-attach-item"));
    items.find((item) => item.textContent.includes("Fetch Web Page")).click();
    await flushUi();

    const dialogInput = document.querySelector(".bds-github-input");
    dialogInput.value = "https://example.com/article";
    dialogInput.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    document.querySelector(".bds-github-btn-import").click();
    await flushUi();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(state.ui.requestWebFetchPermission).toHaveBeenCalledWith({
      url: "https://example.com/article",
      origin: "https://example.com",
      message:
        "Better DeepSeek needs permission to access https://example.com before Web Fetch can continue.",
    });
    expect(webMocks.fetchAndConvertWebPage).toHaveBeenCalledTimes(2);
    expect(nativeInput.files).toHaveLength(1);
    expect(nativeInput.files[0].name).toBe("page.md");
    cleanup();
  });

  it("attaches selected project files and supports voice transcription", async () => {
    const nativeInput = setupNativeInput();
    const attachedFile = new File(["project"], "project.txt", { type: "text/plain" });
    projectFileBuilderMocks.projectFilesToFile.mockReturnValue(attachedFile);
    state.settings.autoSubmitVoice = true;

    let recognitionInstance;
    window.SpeechRecognition = class {
      constructor() {
        recognitionInstance = this;
      }
      start() {
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
    };

    const { target, cleanup } = renderSvelte(AttachMenu, { nativeInput });

    target.querySelector(".bds-project-btn").click();
    await flushUi();
    document.querySelector(".bds-pp-attach").click();
    await flushUi();

    expect(projectFileBuilderMocks.projectFilesToFile).toHaveBeenCalled();
    expect(nativeInput.files).toHaveLength(1);

    target.querySelector(".bds-mic-btn").click();
    recognitionInstance.onresult?.({
      results: Object.assign([[{ transcript: "voice text" }]], {
        0: Object.assign([{ transcript: "voice text" }], { isFinal: true }),
      }),
    });
    await flushUi();
    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(document.querySelector("#chat-input").value).toBe("voice text");
    expect(document.querySelector("button").click).toHaveBeenCalledOnce();
    cleanup();
  });
});
