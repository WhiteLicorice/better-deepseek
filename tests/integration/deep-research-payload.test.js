// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { mutatePayload } from "../../src/injected/payload-mutator.js";

function makeInjectedState() {
  return {
    config: {
      systemPrompt: "",
      systemPromptEntries: [],
      skills: [],
      memories: [],
      activeCharacter: null,
      activeProject: null,
      projectRagEnabled: false,
      deepResearch: {
        enabled: true,
        runId: "run_laptops",
      },
    },
    sessionUserMsgCounts: {},
  };
}

describe("Deep Research payload mutation", () => {
  it("injects one-shot planning instructions into the outbound user prompt", () => {
    const state = makeInjectedState();
    const listener = vi.fn();
    window.addEventListener("bds:deep-research-started", listener, { once: true });

    const payload = {
      conversation_id: "conv_laptops",
      messages: [
        {
          role: "user",
          content: "Research gaming laptop listings under $1500.",
        },
      ],
    };

    const result = mutatePayload(payload, state);
    const content = result.payload.messages[0].content;

    expect(result.changed).toBe(true);
    expect(content).toContain("[BDS:DEEP_RESEARCH] Deep Research mode is enabled");
    expect(content).toContain('<BDS:DEEP_RESEARCH_PLAN runId="run_laptops">');
    expect(content).toContain("Research gaming laptop listings under $1500.");
    expect(state.config.deepResearch.enabled).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
    expect(JSON.parse(listener.mock.calls[0][0].detail).runId).toBe("run_laptops");
  });

  it("does not inject planning instructions after the run config is consumed", () => {
    const state = makeInjectedState();
    const firstPayload = {
      conversation_id: "conv_laptops",
      messages: [{ role: "user", content: "First prompt" }],
    };
    mutatePayload(firstPayload, state);

    const secondPayload = {
      conversation_id: "conv_laptops",
      messages: [{ role: "user", content: "Second prompt" }],
    };
    const result = mutatePayload(secondPayload, state);

    expect(result.payload.messages[0].content).not.toContain("[BDS:DEEP_RESEARCH]");
  });
});
