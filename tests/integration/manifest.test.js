import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { transformManifestForTarget } from "../../scripts/manifest-utils.js";

const manifestPath = path.resolve(process.cwd(), "static/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

describe("manifest permissions", () => {
  it("keeps GitHub hosts required while moving broad site access to optional permissions", () => {
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toContain("https://chat.deepseek.com/*");
    expect(manifest.host_permissions).toContain("https://codeload.github.com/*");
    expect(manifest.host_permissions).toContain("https://api.github.com/*");
    expect(manifest.host_permissions).not.toContain("<all_urls>");
    expect(manifest.optional_host_permissions).toContain("<all_urls>");
    expect(manifest.web_accessible_resources[0].resources).toContain(
      "static/web-fetch-permission.html",
    );
    expect(manifest.web_accessible_resources[0].resources).toContain(
      "static/web-fetch-permission.js",
    );
  });

  it("adds Firefox optional_permissions fallback for optional host permissions", () => {
    const firefoxManifest = transformManifestForTarget(manifest, "firefox");

    expect(firefoxManifest.optional_host_permissions).toContain("<all_urls>");
    expect(firefoxManifest.optional_permissions).toContain("<all_urls>");
    expect(firefoxManifest.browser_specific_settings?.gecko?.strict_min_version).toBe("109.0");
    expect(firefoxManifest.permissions).toEqual(["storage"]);
    expect(firefoxManifest.sandbox).toBeUndefined();
  });
});
