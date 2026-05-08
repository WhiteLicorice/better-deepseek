import { describe, expect, it } from "vitest";
import {
  getBroadSiteAccessHint,
  getBuildTarget,
  getSiteAccessGuide,
} from "../../src/content/site-access-hint.js";

describe("site-access hint helpers", () => {
  it("defaults to the chrome target", () => {
    expect(getBuildTarget("")).toBe("chrome");
    expect(getSiteAccessGuide("chrome")).toMatchObject({
      location: "chrome://extensions",
      action: "choose On all sites",
    });
  });

  it("returns firefox-specific blanket access guidance", () => {
    expect(getSiteAccessGuide("firefox")).toMatchObject({
      location: "about:addons",
      action: "allow access to all websites",
    });
    expect(getBroadSiteAccessHint("firefox")).toContain("about:addons");
  });

  it("hides blanket access guidance on android", () => {
    expect(getSiteAccessGuide("android")).toBeNull();
    expect(getBroadSiteAccessHint("android")).toBe("");
  });
});
