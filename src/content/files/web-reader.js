/**
 * Web Page Reader
 * Fetches HTML via background script, extracts main content with Readability,
 * and converts to Markdown with Turndown.
 */

import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

async function ensureWebFetchPermission(url, interactive) {
  const response = await chrome.runtime.sendMessage({
    type: "bds-ensure-host-permission",
    url,
    interactive,
  });

  if (response && response.ok) {
    return;
  }

  const origin = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
  })();

  if (response?.denied) {
    throw new Error(
      `Web Fetch permission was denied for ${origin}. Allow access and try again.`,
    );
  }

  if (response?.permissionRequired) {
    throw new Error(
      `Web Fetch needs permission to access ${origin}. Try again and approve the permission prompt.`,
    );
  }

  throw new Error(response?.error || `Could not get permission for ${origin}.`);
}

export async function fetchAndConvertWebPage(
  url,
  onStatus = () => { },
  options = {},
) {
  try {
    await ensureWebFetchPermission(
      url,
      options.interactive !== false,
    );
    onStatus("Fetching page content...");
    const response = await chrome.runtime.sendMessage({
      type: "bds-fetch-url",
      url: url
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || "Failed to fetch page.");
    }

    onStatus("Processing content...");
    const html = response.html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Re-base URLs if possible so links aren't broken relative to the current site
    const base = doc.createElement("base");
    base.href = url;
    doc.head.appendChild(base);

    // Use Readability to get the core content
    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article) {
      throw new Error("Could not parse main content from this page.");
    }

    onStatus("Converting to Markdown...");
    const turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced"
    });

    // Remove some unwanted elements that Readability might have missed or that Turndown handles poorly
    const markdown = turndownService.turndown(article.content);

    const finalOutput = `Title: ${article.title}\nURL: ${url}\nAuthor: ${article.byline || "Unknown"}\nSite: ${article.siteName || "Unknown"}\n\n${"=".repeat(64)}\n\n${markdown}`;

    onStatus("Creating file...");
    const blob = new Blob([finalOutput], { type: "text/markdown" });
    const fileName = (article.title || "web-page")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .slice(0, 50) + ".md";

    return new File([blob], fileName, { type: "text/markdown" });
  } catch (err) {
    console.error("[WebReader] Error:", err);
    throw err;
  }
}
