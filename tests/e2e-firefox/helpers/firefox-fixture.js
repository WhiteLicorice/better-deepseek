/**
 * Firefox E2E fixture — Selenium WebDriver + BiDi network interception.
 *
 * Launches Firefox with BiDi, temporarily installs the unsigned dist-firefox
 * extension (unmodified), and serves the deterministic mock fixture through
 * network.addIntercept + network.continueResponse.
 *
 * BiDi URL patterns use structured hostname matching (no globs — the *
 * character is forbidden). BiDi events are flat (no params wrapper).
 *
 * BiDi-served HTML does not execute inline scripts in Firefox, so the
 * mock API (window.__mockDeepSeek) is injected via executeScript.
 *
 * Requirements:
 *   - Firefox Stable (set FIREFOX_BIN to override).
 *   - dist-firefox built (`npm run build`).
 *   - Selenium Manager auto-provisions GeckoDriver.
 */

import fs from "node:fs";
import path from "node:path";
import { Builder } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

const projectRoot = process.cwd();
const extensionPath = path.resolve(projectRoot, "dist-firefox");
const manifestPath = path.join(extensionPath, "manifest.json");
const fixtureHtml = fs.readFileSync(
  path.resolve(projectRoot, "tests/e2e/fixtures/mock-deepseek.html"),
  "utf8",
);

import {
  pricingHtml,
  pricingJson,
  githubZip,
  githubCommits,
} from "../../e2e/fixtures/payloads.js";

function toBase64(body) {
  return typeof body === "string"
    ? Buffer.from(body).toString("base64")
    : Buffer.from(body).toString("base64");
}

function resolveResponse(url) {
  // Mock fixture page
  if (url.startsWith("https://chat.deepseek.com")) {
    return { statusCode: 200, body: fixtureHtml, mediaType: "text/html; charset=utf-8" };
  }
  // Pricing / docs
  if (url.startsWith("https://api-docs.deepseek.com")) {
    return { statusCode: 200, body: pricingHtml, mediaType: "text/html; charset=utf-8" };
  }
  if (url === "https://raw.githubusercontent.com/EdgeTypE/better-deepseek/main/extension/pricing.json") {
    return { statusCode: 200, body: pricingJson, mediaType: "application/json; charset=utf-8" };
  }
  // GitHub
  if (url.startsWith("https://codeload.github.com/octocat/Hello-World/zip/refs/heads/")) {
    return { statusCode: 200, body: githubZip, mediaType: "application/zip" };
  }
  if (url.startsWith("https://api.github.com/repos/octocat/Hello-World/commits")) {
    return { statusCode: 200, body: JSON.stringify(githubCommits), mediaType: "application/json; charset=utf-8" };
  }
  // DeepSeek status API — return empty healthy response
  if (url.startsWith("https://status.deepseek.com")) {
    return { statusCode: 200, body: '{"status":"ok"}', mediaType: "application/json; charset=utf-8" };
  }
  // AWS WAF / captcha — return empty 200 to prevent challenge redirects
  if (url.includes("awswaf.com") || url.includes("captcha.awswaf.com")) {
    return { statusCode: 200, body: "", mediaType: "text/plain" };
  }
  return null;
}

const MOCK_API_SCRIPT = [
  '(function(){',
  'if(window.__mockDeepSeek)return;',
  'function cn(role){var d=document.createElement("div");',
  'd.className=role==="user"?"ds-message d29f3d7d _63c77b1":"ds-message _63c77b1";',
  'd.setAttribute("data-message-author-role",role);return d;}',
  'function ct(role,t){var n=cn(role);var m=document.createElement("div");',
  'm.className=role==="user"?"fbb737a4 ds-markdown":"ds-markdown";',
  'm.textContent=t;n.appendChild(m);return n;}',
  'function ap(n){var c=document.querySelector("#chat-messages");',
  'if(c)c.appendChild(n);return n;}',
  'function sm(count){var c=document.querySelector("#chat-messages");',
  'if(!c)return 0;var f=document.createDocumentFragment();',
  'for(var i=0;i<count;i++){var r=i%2===0?"user":"assistant";',
  'f.appendChild(ct(r,("Seed msg "+(i+1)+". ").repeat(8).trim()));}',
  'c.appendChild(f);return c.querySelectorAll(".ds-message").length;}',
  'window.__mockDeepSeek={addAssistantMessage:function(t){return ap(ct("assistant",t));},',
  'addUserMessage:function(t){return ap(ct("user",t));},',
  'seedMessages:sm,lastSubmittedText:""};',
  '})();',
].join("");

export async function createFirefoxFixture() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Missing dist-firefox build. Run `npm run build` first.");
  }

  const firefoxBin = process.env.FIREFOX_BIN || undefined;
  const firefoxOpts = new firefox.Options();
  if (firefoxBin) firefoxOpts.setBinary(firefoxBin);
  firefoxOpts.enableBidi();
  if (process.env.CI) firefoxOpts.addArguments("--headless");
  firefoxOpts.setAcceptInsecureCerts(true);

  const driver = await new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(firefoxOpts)
    .build();

  let bidi = null;
  let extensionId = null;
  let interceptActive = true;

  try {
    // CRITICAL: register BiDi intercepts BEFORE installing the extension.
    // If the extension loads first, its background script may hit the real
    // site before intercepts are active, caching the live page.
    bidi = await driver.getBidi();

    await bidi.send({
      method: "network.addIntercept",
      params: {
        phases: ["beforeRequestSent"],
        urlPatterns: [
          { type: "pattern", hostname: "chat.deepseek.com" },
          { type: "pattern", hostname: "api-docs.deepseek.com" },
          { type: "pattern", hostname: "status.deepseek.com" },
          { type: "pattern", hostname: "raw.githubusercontent.com" },
          { type: "pattern", hostname: "codeload.github.com" },
          { type: "pattern", hostname: "api.github.com" },
        ],
      },
    });

    await bidi.subscribe("network.beforeRequestSent");

    // BiDi events are flat — no `params` wrapper.
    // Use network.provideResponse (not continueResponse) for mock responses.
    bidi.on("network.beforeRequestSent", async (event) => {
      if (!interceptActive) return;
      const url = event?.request?.url || "";
      const resolved = resolveResponse(url);
      if (process.env.BDS_FX_DEBUG) console.log("[BDS-FX]", resolved ? "MATCH" : "SKIP", url.substring(0, 80));
      if (!resolved) return;
      try {
        await bidi.send({
          method: "network.provideResponse",
          params: {
            request: event.request.request,
            statusCode: resolved.statusCode,
            reasonPhrase: "OK",
            headers: [
              { name: "Content-Type", value: { type: "string", value: resolved.mediaType } },
            ],
            body: { type: "base64", value: toBase64(resolved.body) },
          },
        });
      } catch (e) {
        console.warn("[Firefox E2E] provideResponse failed:", e.message);
      }
    });

    // Install extension AFTER intercepts are active
    extensionId = await driver.installAddon(extensionPath, true);

    // Navigate — intercepted to serve mock HTML
    await driver.get("https://chat.deepseek.com/");
    await driver.sleep(1500);

    // Inject mock API (BiDi-served HTML inline scripts don't execute)
    await driver.executeScript(MOCK_API_SCRIPT);
    await driver.sleep(3000);

    return {
      driver,
      bidi,
      extensionId,
      async close() {
        interceptActive = false;
        try { await driver.quit(); } catch { /* ignore */ }
      },
      async takeScreenshot(filename) {
        const raw = await driver.takeScreenshot();
        fs.writeFileSync(filename, raw, "base64");
      },
      async getPageHtml() {
        return driver.getPageSource();
      },
    };
  } catch (e) {
    interceptActive = false;
    try { await driver.quit(); } catch { /* ignore */ }
    throw e;
  }
}
