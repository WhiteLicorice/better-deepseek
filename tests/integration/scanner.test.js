// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppState } from "../helpers/app-state.js";

const mountMock = vi.hoisted(() => vi.fn(() => ({})));
const deepResearchToggleMock = vi.hoisted(() => ({ name: "DeepResearchToggle" }));
const attachMenuMock = vi.hoisted(() => ({ name: "AttachMenu" }));
const expandToggleMock = vi.hoisted(() => ({ name: "ExpandToggle" }));
const ragPreviewMock = vi.hoisted(() => ({ name: "RagPreview" }));

vi.mock("svelte", () => ({
  mount: mountMock,
}));

vi.mock("../../src/content/message-processor.svelte.js", () => ({
  processMessageNode: vi.fn(),
}));

vi.mock("../../src/content/ui/AttachMenu.svelte", () => ({
  default: attachMenuMock,
}));

vi.mock("../../src/content/ui/ExpandToggle.svelte", () => ({
  default: expandToggleMock,
}));

vi.mock("../../src/content/ui/RagPreview.svelte", () => ({
  default: ragPreviewMock,
}));

vi.mock("../../src/content/ui/DeepResearchToggle.svelte", () => ({
  default: deepResearchToggleMock,
}));

vi.mock("../../src/content/ui/SidebarSearch.js", () => ({
  injectSearchInput: vi.fn(),
}));

vi.mock("../../src/content/tools/pending-export.js", () => ({
  checkPendingExport: vi.fn(),
}));

vi.mock("../../src/content/tags/tag-hider.js", () => ({
  hideTagsInHeader: vi.fn(),
  hideTagsInSidebar: vi.fn(),
}));

vi.mock("../../src/content/deep-research.js", () => ({
  setDeepResearchEnabled: vi.fn(),
}));

describe("scanner input controls", () => {
  beforeEach(() => {
    resetAppState();
    mountMock.mockClear();
    document.body.innerHTML = "";
  });

  it("mounts Deep Research before the attach menu when the composer was already partially mounted", async () => {
    document.body.innerHTML = `
      <div id="composer" data-bds-attach-menu-mounted="true">
        <div role="button" tabindex="0"></div>
        <div class="bds-attach-menu-mount" data-bds-mounted="1">
          <div class="bds-attach-wrapper"></div>
        </div>
        <input type="file" multiple />
      </div>
    `;
    const { scanInputArea } = await import("../../src/content/scanner.js");

    scanInputArea();

    const wrapper = document.querySelector("#composer");
    const fileInput = document.querySelector('input[type="file"][multiple]');
    const deepResearchMount = wrapper.querySelector(".bds-deep-research-mount");
    const attachMount = wrapper.querySelector(".bds-attach-menu-mount");
    const children = Array.from(wrapper.children);

    expect(deepResearchMount).toBeTruthy();
    expect(children.indexOf(deepResearchMount)).toBeLessThan(children.indexOf(attachMount));
    expect(children.indexOf(deepResearchMount)).toBeLessThan(children.indexOf(fileInput));
    expect(deepResearchMount.dataset.bdsMounted).toBe("1");
    expect(mountMock.mock.calls[0][0]).toBe(deepResearchToggleMock);
    expect(mountMock.mock.calls[0][1].target).toBe(deepResearchMount);
  });
});
