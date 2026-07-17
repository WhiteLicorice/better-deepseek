/**
 * Firefox E2E contracts — built-extension verification through Selenium + BiDi.
 *
 * Contracts:
 *   1. Extension boots and exposes primary controls.
 *   2. Storage quiescence (#108): probe-based, correlation-ID awaited, total===1.
 *   3. Performance (#105): observable append timing.
 *   4. Host wrapper: .bds-download-card inside .bds-host-wrapper, block-level, nonzero.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFirefoxFixture } from "./helpers/firefox-fixture.js";

describe("Firefox extension", () => {
  let fx;

  beforeAll(async () => {
    fx = await createFirefoxFixture();
  }, 60000);

  afterAll(async () => {
    if (!fx) return;
    const err = fx.getFixtureError();
    // Don't catch close errors — must propagate
    await fx.close();
    if (err) throw err;
  }, 15000);

  // Shared correlated debug request helper
  async function debugRequest(driver, id, method, args = []) {
    return driver.executeScript(
      `return new Promise((resolve, reject) => {
        var timeout = setTimeout(() => reject(new Error("debugRequest ${id} timed out")), 10000);
        var handler = function(e) {
          var detail = e.detail;
          if (typeof detail === "string") detail = JSON.parse(detail);
          if (detail.id === "${id}") {
            clearTimeout(timeout);
            window.removeEventListener("bds:debug-api-response", handler);
            resolve(detail.result);
          }
        };
        window.addEventListener("bds:debug-api-response", handler);
        window.dispatchEvent(new CustomEvent("bds:debug-api-request", {
          detail: JSON.stringify({id:"${id}",method:"${method}",args:${JSON.stringify(args)}})
        }));
      });`
    );
  }

  it("boots on the fixture and exposes primary controls", async () => {
    const healthy = await fx.isDriverHealthy();
    expect(healthy).toBe(true);

    const toggle = await fx.driver.findElement({ css: "#bds-toggle" });
    expect(await toggle.isDisplayed()).toBe(true);

    const plusBtn = await fx.driver.findElement({ css: ".bds-plus-btn" });
    expect(plusBtn).toBeTruthy();
  });

  it("produces exactly one config-updated event, zero for identical repeat, stable during idle", async () => {
    const { driver } = fx;
    const ts = Date.now();

    try {
      // Start the storage probe
      await debugRequest(driver, "probe-start", "startStorageProbe");

      // Init page-level event counter
      await driver.executeScript(`
        window.__bdsFfEvents = { remoteConfigUpdated: 0 };
        window.addEventListener("bds:remote-config-updated", () => {
          window.__bdsFfEvents.remoteConfigUpdated++;
        });
      `);

      // Unique replaceRemote
      await debugRequest(driver, "fx-1", "replaceRemote", [{ features: { testFirefox: true, ts } }]);
      await driver.sleep(300);

      const afterFirst = await driver.executeScript("return window.__bdsFfEvents.remoteConfigUpdated;");
      expect(afterFirst).toBe(1);

      // Verify probe: exactly 1 total event, 1 remoteConfig event
      const probe1 = await debugRequest(driver, "probe-get-1", "getStorageProbe");
      expect(probe1.total).toBe(1);
      expect(probe1.remoteConfig).toBe(1);

      // Idle window — counts must remain stable
      await driver.sleep(500);
      const afterIdle = await driver.executeScript("return window.__bdsFfEvents.remoteConfigUpdated;");
      expect(afterIdle).toBe(1);

      // Identical replacement with reordered keys — zero additional events
      await debugRequest(driver, "fx-2", "replaceRemote", [{ features: { ts, testFirefox: true } }]);
      await driver.sleep(500);

      const afterRepeat = await driver.executeScript("return window.__bdsFfEvents.remoteConfigUpdated;");
      expect(afterRepeat).toBe(1);

      const probe2 = await debugRequest(driver, "probe-get-2", "getStorageProbe");
      expect(probe2.total).toBe(1);
    } finally {
      await debugRequest(driver, "probe-stop", "stopStorageProbe");
      await driver.executeScript("window.__bdsFfEvents = null;");
    }
  });

  it("processes messages within time bounds at 200 and 2000 scale", async () => {
    const { driver } = fx;
    const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

    // 200 baseline
    await driver.executeScript("window.__mockDeepSeek.clearMessages();");
    await driver.executeScript("window.__mockDeepSeek.seedMessages(200);");
    const settled200 = await driver.executeScript(
      "return window.__mockDeepSeek.waitForAllMessagesProcessed(200, 30000);",
    );
    expect(settled200).toBe(200);

    const smallSamples = [];
    for (let i = 0; i < 5; i++) {
      const result = await driver.executeScript(
        'return window.__mockDeepSeek.appendAndMeasureProcessing("Firefox timing ' + i + '", 5000);',
      );
      smallSamples.push(result.duration);
      expect(result.duration).toBeLessThan(2000);
    }
    expect(smallSamples).toHaveLength(5);

    // 2000 baseline
    await driver.executeScript("window.__mockDeepSeek.clearMessages();");
    await driver.executeScript("window.__mockDeepSeek.seedMessages(2000);");
    const settled2000 = await driver.executeScript(
      "return window.__mockDeepSeek.waitForAllMessagesProcessed(2000, 60000);",
    );
    expect(settled2000).toBe(2000);

    const largeSamples = [];
    for (let i = 0; i < 5; i++) {
      const result = await driver.executeScript(
        'return window.__mockDeepSeek.appendAndMeasureProcessing("Firefox large ' + i + '", 5000);',
      );
      largeSamples.push(result.duration);
      expect(result.duration).toBeLessThan(2000);
    }
    expect(largeSamples).toHaveLength(5);

    expect(median(largeSamples)).toBeLessThanOrEqual(median(smallSamples) * 2.5);
    expect(median(largeSamples) - median(smallSamples)).toBeLessThanOrEqual(750);
  }, 120000);

  it("renders create_file download card in host wrapper with block-level box", async () => {
    const { driver } = fx;
    await driver.executeScript("window.__mockDeepSeek.clearMessages();");

    await driver.executeScript(`
      window.__mockDeepSeek.addAssistantMessage(
        '<BDS:CREATE_FILE fileName="test-firefox.txt">\\nHello Firefox E2E\\n</BDS:CREATE_FILE>'
      );
    `);

    // Await download card visibility with WebDriver wait
    const card = await driver.wait(
      async () => {
        try { return await driver.findElement({ css: ".bds-download-card" }); } catch { return null; }
      },
      10000,
      "Download card not found within 10s",
    );
    expect(card).toBeTruthy();

    const wrapper = await driver.findElement({ css: ".bds-host-wrapper" });
    expect(wrapper).toBeTruthy();

    // Card must be a descendant of the wrapper
    const isDescendant = await driver.executeScript(
      "return arguments[0].contains(arguments[1]);",
      wrapper, card,
    );
    expect(isDescendant).toBe(true);

    const rect = await driver.executeScript(
      "var r = arguments[0].getBoundingClientRect(); return { w: r.width, h: r.height };",
      wrapper,
    );
    expect(rect.w).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);

    const display = await wrapper.getCssValue("display");
    expect(display).not.toBe("contents");
  });
});
