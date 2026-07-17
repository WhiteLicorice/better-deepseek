import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/e2e-firefox/**/*.spec.js"],
    testTimeout: 60000,
    hookTimeout: 60000,
    // Firefox E2E runs in node environment (Selenium controls the browser)
    environment: "node",
    globals: false,
    reporters: process.env.CI ? ["default", "html"] : ["default"],
    outputFile: {
      html: "./test-results-firefox/index.html",
    },
  },
});
