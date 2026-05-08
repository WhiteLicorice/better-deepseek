// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import state from "../../src/content/state.js";
import { resetAppState } from "../helpers/app-state.js";

const mocks = vi.hoisted(() => ({
  processMessageNode: vi.fn(),
  enhanceCodeBlockDownloads: vi.fn(),
  injectSearchInput: vi.fn(),
}));

vi.mock("../../src/content/message-processor.svelte.js", () => ({
  processMessageNode: mocks.processMessageNode,
}));
vi.mock("../../src/content/files/code-blocks.js", () => ({
  enhanceCodeBlockDownloads: mocks.enhanceCodeBlockDownloads,
}));
vi.mock("../../src/content/ui/SidebarSearch.js", () => ({
  injectSearchInput: mocks.injectSearchInput,
}));
vi.mock("../../src/content/tools/pending-export.js", () => ({
  checkPendingExport: vi.fn(),
}));

import { observeChatDom } from "../../src/content/scanner.js";

describe("scanner integration", () => {
  beforeEach(() => {
    if (state.observer) {
      state.observer.disconnect();
    }
    resetAppState();
    document.body.innerHTML = "";
    mocks.processMessageNode.mockReset();
    mocks.enhanceCodeBlockDownloads.mockReset();
    mocks.injectSearchInput.mockReset();
    vi.useFakeTimers();
  });

  it("rescans when a message mutates text content in place", async () => {
    document.body.innerHTML = `
      <div class="ds-message _63c77b1">
        <div class="ds-markdown">Initial response</div>
      </div>
    `;

    observeChatDom();

    const markdown = document.querySelector(".ds-markdown");
    markdown.firstChild.textContent =
      "Initial response <BDS:AUTO:REQUEST_WEB_FETCH>https://example.com</BDS:AUTO:REQUEST_WEB_FETCH>";

    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(141);

    expect(mocks.processMessageNode).toHaveBeenCalledOnce();
    expect(mocks.processMessageNode.mock.calls[0][0]).toBe(
      document.querySelector(".ds-message"),
    );
  });
});
