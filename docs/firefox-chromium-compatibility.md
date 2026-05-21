# Firefox / Chromium Compatibility in Better DeepSeek

This document explains how Better DeepSeek (BDS) produces extension bundles that run on both
Firefox and Chromium-based browsers, and how the same patterns apply to any web extension project.

---

## 1. The Problem

Firefox and Chromium share the Manifest V3 (MV3) specification but diverge on a handful of
implementation details that would otherwise break an extension:

| Area | Chromium | Firefox MV3 |
|---|---|---|
| Background execution | Service worker (`background.service_worker`) | Either a service worker **or** a classic background script (`background.scripts`) |
| `type: "module"` in background | Required when bundling ES modules | Not reliably supported for IIFE bundles |
| `content_security_policy.sandbox` key | Supported | **Not supported** — must be removed |
| Extension identity | No `browser_specific_settings` needed | Requires `browser_specific_settings.gecko.id` |
| `CustomEvent.detail` across world boundaries | Plain object is passed by reference | Firefox Xray Vision serialises the object; receiving side gets a **string** or a clone |
| Non-ASCII characters in bundles | Handled natively | Can cause parsing failures in older Firefox versions |

---

## 2. How BDS Solves Each Problem

### 2.1 Single source, two manifest outputs

`static/manifest.json` is the authoritative manifest. It is written in Chromium format.
During a build, `build.js` reads this file and, when `--target=firefox` is set, applies the
following transformations before writing the output manifest to `dist-firefox/manifest.json`:

```js
// build.js (simplified)
if (target === "firefox") {
  // 1. Add Firefox extension identity
  manifest.browser_specific_settings = {
    gecko: {
      id: "betterdeepseek@goygoyengine.com",
      strict_min_version: "109.0",
    },
  };

  // 2. Replace service_worker with scripts[] (IIFE format, no type: "module")
  if (manifest.background?.service_worker) {
    manifest.background = {
      scripts: [manifest.background.service_worker],
    };
  }

  // 3. Drop the sandbox CSP key — Firefox MV3 rejects it
  if (manifest.content_security_policy) {
    delete manifest.content_security_policy.sandbox;
  }
}
```

The Chromium manifest is left unchanged. This single-source approach means every feature
(permissions, host permissions, content scripts, web-accessible resources) is declared once and
is identical across browsers unless a browser requires an override.

### 2.2 IIFE bundle format instead of ES modules

All four bundles (content script, background, injected script, sandbox script) are built with
Rollup's `iife` output format and `inlineDynamicImports: true`. This eliminates the
`type: "module"` declaration that Firefox does not support reliably for background scripts, and
it sidesteps the `import()` / dynamic-chunk issues that arise in extension CSP contexts.

```js
// build.js — shared output config for every entry
output: {
  format: "iife",
  inlineDynamicImports: true,
},
```

### 2.3 Firefox Xray Vision — always stringify `CustomEvent.detail`

Firefox enforces **Xray Vision**: when a `CustomEvent` crosses the boundary between the
**MAIN world** (page / injected script) and the **ISOLATED world** (content script), the
`detail` property is deep-cloned or serialised. Passing a plain object works in Chromium but
arrives as a string (or an opaque Xray wrapper) in Firefox.

BDS handles this by always serialising `detail` to JSON on the sending side and always
defensively parsing it on the receiving side:

**Sending (injected script — MAIN world):**

```js
// src/injected/index.js
window.dispatchEvent(
  new CustomEvent(EVENTS.networkState, {
    detail: JSON.stringify(detail),   // always a string
  })
);
```

**Receiving (content script — ISOLATED world):**

```js
// src/content/bridge.js
window.addEventListener(BRIDGE_EVENTS.networkState, (event) => {
  let detail = event.detail;
  if (typeof detail === "string") {
    try {
      detail = JSON.parse(detail);
    } catch (e) {
      console.error("[BDS] Failed to parse networkState detail:", e);
    }
  }
  handleNetworkState(detail);
});
```

This same pattern is repeated for every `CustomEvent` that crosses the world boundary
(`bds:config-update`, `bds:session-data`, `bds:token-usage`, `bds:mutation-applied`,
`bds:network-error`, `bds:debug-api-request`, `bds:debug-api-response`).

### 2.4 Non-ASCII sanitisation

After each build, `scripts/sanitize-dist.js` scans the output bundles for bytes above 0x7F
and replaces them with `\uXXXX` escape sequences. This prevents Firefox's parser from
rejecting extension scripts that contain multi-byte Unicode characters baked in by Vite/Rollup.

The Vite `esbuild.charset: 'ascii'` option is also set for the same reason — it instructs
esbuild to emit only ASCII output before the sanitiser runs as a second safety net.

### 2.5 Sandbox page — same HTML, different CSP

`static/sandbox.html` is copied to both `dist-chrome/` and `dist-firefox/` unchanged.
The sandboxed page itself does not change across browsers.

The only browser-specific detail is in the manifest:

- Chromium: `manifest.content_security_policy.sandbox` key is present, setting
  `"sandbox allow-scripts …; script-src 'self' 'unsafe-eval' …"`.
- Firefox: the `sandbox` CSP key is deleted from the manifest entirely (see §2.1 above).
  Firefox derives sandbox permissions from the `<iframe sandbox>` attribute that the content
  script sets when it embeds the page.

### 2.6 `chrome.*` API — naturally compatible

BDS uses only a small, stable subset of the extension API surface:

- `chrome.storage.local.get` / `.set` / `.remove`
- `chrome.storage.onChanged`
- `chrome.runtime.sendMessage` / `onMessage`
- `chrome.runtime.getURL`
- `chrome.runtime.onInstalled`
- `chrome.action.onClicked`

Firefox ships a full `chrome.*` alias for all of these. No polyfill or `browser.*` → `chrome.*`
wrapper is required.

---

## 3. Build Commands

| Command | Output directory | Target |
|---|---|---|
| `npm run build:chrome` | `dist-chrome/` | Chromium |
| `npm run build:firefox` | `dist-firefox/` | Firefox |
| `npm run build` | both | Chromium + Firefox |

Each command produces a ready-to-load unpacked extension directory and a corresponding ZIP
(`better-deepseek-chrome.zip` / `better-deepseek-firefox.zip`).

---

## 4. Generalising These Patterns to Any Web Extension

The techniques BDS uses are not specific to this project. Any MV3 extension that targets both
Firefox and Chromium can apply the same approach.

### 4.1 Manifest patching at build time

Keep a single `manifest.json` in source control (write it in Chromium format — it is the
reference implementation). At build time, read it, apply Firefox-specific overrides
programmatically, and write the patched version to the Firefox output directory.

Minimum overrides required for Firefox MV3:

1. Add `browser_specific_settings.gecko.id` (Firefox rejects unsigned extensions without one).
2. Convert `background.service_worker` → `background.scripts: [...]` if your bundle is IIFE.
3. Delete `content_security_policy.sandbox` if it is present.

### 4.2 Prefer IIFE bundles over ES module chunks

Build every extension entry point as a self-contained IIFE. Bundlers (Rollup, esbuild, Webpack)
all support this. This sidesteps `type: "module"` support gaps in Firefox background scripts and
avoids dynamic-import CSP issues in both browsers.

### 4.3 Always serialise `CustomEvent.detail` to JSON

Any time your extension passes structured data between the **MAIN world** and the
**ISOLATED world** through `CustomEvent`, always:

- Set `detail: JSON.stringify(payload)` when dispatching.
- Check `typeof detail === "string"` and call `JSON.parse(detail)` when receiving.

This is the only reliable cross-browser approach. Passing a plain object works in Chromium but
breaks silently in Firefox due to Xray Vision.

### 4.4 Use ASCII-safe bundles

Run a post-build step that replaces any non-ASCII bytes in JS bundles with `\uXXXX` escapes,
or configure your bundler to emit ASCII-only output (esbuild: `charset: 'ascii'`; Terser:
`output.ascii_only: true`). Firefox versions prior to the current release window are more
likely to reject extensions with non-ASCII content in scripts.

### 4.5 Stick to the shared `chrome.*` surface

Firefox supports `chrome.*` as an alias for `browser.*` for all commonly used APIs. Using
`chrome.*` exclusively means no runtime polyfill is needed. If you need APIs that differ
(e.g. `browser.tabs.query` returns a Promise in Firefox but requires a callback in Chromium
if you use `chrome.tabs.query`), wrap only those specific call sites behind a thin shim rather
than wholesale polyfilling the entire `chrome` namespace.

### 4.6 Test both browsers in CI

The BDS CI pipeline currently tests only the Chromium build in the web lane. For maximum
confidence, add a Firefox lane that:

1. Builds `dist-firefox/` with `npm run build:firefox`.
2. Loads the extension with a Firefox-capable test driver (Playwright supports Firefox with
   `--channel=firefox`; Selenium supports it via `geckodriver`).
3. Runs the same E2E suite against both browsers.

---

## 5. File and Code Map

| File | Role |
|---|---|
| `static/manifest.json` | Source-of-truth manifest (Chromium format) |
| `build.js` | Build orchestrator; applies Firefox overrides to the manifest |
| `src/content/index.js` | Content script entry; imports `bds-platform-globals` alias |
| `src/content/bridge.js` | `CustomEvent` bridge between ISOLATED and MAIN worlds; handles Xray Vision parsing |
| `src/injected/index.js` | MAIN-world injected script; always stringifies `CustomEvent.detail` |
| `src/background/index.js` | Background service worker / script; uses `chrome.*` API only |
| `src/platform/globals-chrome.js` | No-op platform entry for Chrome/Firefox builds |
| `src/platform/globals-android.js` | Android platform entry; installs `chrome.*` polyfill |
| `src/platform/android-chrome-polyfill.js` | Full `chrome.storage` / `chrome.runtime` shim for Android WebView |
| `scripts/sanitize-dist.js` | Post-build ASCII sanitiser for extension bundles |
| `static/sandbox.html` | Sandboxed page for `unsafe-eval` document generation (PPTX, XLSX, DOCX) |
