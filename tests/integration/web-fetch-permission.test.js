import { beforeEach, describe, expect, it } from "vitest";
import {
  checkWebFetchPermissionGrant,
  isDeadObjectAccessError,
} from "../../src/content/web-fetch-permission.js";

describe("web-fetch-permission integration", () => {
  beforeEach(() => {
    chrome.runtime.sendMessage.mockReset();
  });

  it("treats dead-object runtime failures as an unresolved permission check", async () => {
    chrome.runtime.sendMessage.mockRejectedValueOnce(
      new TypeError("can't access dead object"),
    );

    await expect(
      checkWebFetchPermissionGrant("https://example.com/article"),
    ).resolves.toBe(false);
  });

  it("rethrows non-dead-object runtime failures", async () => {
    const error = new Error("boom");
    chrome.runtime.sendMessage.mockRejectedValueOnce(error);

    await expect(
      checkWebFetchPermissionGrant("https://example.com/article"),
    ).rejects.toBe(error);
  });

  it("recognizes Firefox dead-object access errors", () => {
    expect(
      isDeadObjectAccessError(new TypeError("can't access dead object")),
    ).toBe(true);
    expect(isDeadObjectAccessError(new Error("boom"))).toBe(false);
  });
});
