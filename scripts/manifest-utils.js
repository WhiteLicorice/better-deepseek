function dedupe(items) {
  return Array.from(new Set(items));
}

export function transformManifestForTarget(inputManifest, target) {
  const manifest = structuredClone(inputManifest);

  if (target === "firefox") {
    manifest.browser_specific_settings = {
      gecko: {
        id: "betterdeepseek@goygoyengine.com",
        strict_min_version: "109.0",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    };

    if (manifest.background && manifest.background.service_worker) {
      manifest.background = {
        scripts: [manifest.background.service_worker],
      };
    }

    if (manifest.content_security_policy) {
      delete manifest.content_security_policy.sandbox;
    }

    delete manifest.sandbox;

    const optionalHosts = Array.isArray(manifest.optional_host_permissions)
      ? manifest.optional_host_permissions
      : [];
    manifest.optional_permissions = dedupe([
      ...(Array.isArray(manifest.optional_permissions)
        ? manifest.optional_permissions
        : []),
      ...optionalHosts,
    ]);
  }

  return manifest;
}
