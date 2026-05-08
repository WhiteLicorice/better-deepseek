const DEFAULT_BUILD_TARGET = "chrome";

export function getBuildTarget(targetOverride = null) {
  const target = String(
    targetOverride || process.env.BDS_TARGET || DEFAULT_BUILD_TARGET,
  )
    .trim()
    .toLowerCase();

  if (target === "firefox" || target === "android") {
    return target;
  }

  return DEFAULT_BUILD_TARGET;
}

export function getSiteAccessGuide(targetOverride = null) {
  const target = getBuildTarget(targetOverride);

  if (target === "android") {
    return null;
  }

  if (target === "firefox") {
    return {
      target,
      browserName: "Firefox",
      location: "about:addons",
      pathTail: "Better DeepSeek -> Permissions",
      action: "allow access to all websites",
      summary:
        "Open about:addons, choose Better DeepSeek, then allow access to all websites.",
    };
  }

  return {
    target,
    browserName: "Chrome",
    location: "chrome://extensions",
    pathTail: "Better DeepSeek -> Site access",
    action: "choose On all sites",
    summary:
      "Open chrome://extensions, choose Better DeepSeek, then set Site access to On all sites.",
  };
}

export function getBroadSiteAccessHint(targetOverride = null) {
  const guide = getSiteAccessGuide(targetOverride);
  if (!guide) {
    return "";
  }

  return (
    "Tired of granting access for every site? " +
    guide.summary +
    " This removes repeated permission prompts for Web Fetch, YouTube Fetch, and other auto-tools."
  );
}
