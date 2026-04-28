import { buildZip } from "../lib/zip.js";
import { triggerBlobDownload } from "../lib/utils/download.js";
import { buildTimestamp } from "../lib/utils/helpers.js";

const MIME_BY_EXTENSION = {
  js: "text/javascript",
  jsx: "text/javascript",
  ts: "text/plain",
  tsx: "text/plain",
  svelte: "text/plain",
  vue: "text/plain",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  scss: "text/plain",
  json: "application/json",
  md: "text/markdown",
  txt: "text/plain",
  py: "text/x-python",
  go: "text/plain",
  rs: "text/plain",
  java: "text/plain",
  kt: "text/plain",
  swift: "text/plain",
  c: "text/plain",
  cpp: "text/plain",
  h: "text/plain",
  hpp: "text/plain",
  cs: "text/plain",
  rb: "text/plain",
  php: "text/plain",
  sh: "text/x-shellscript",
  yaml: "text/yaml",
  yml: "text/yaml",
  toml: "text/plain",
  xml: "text/xml",
  csv: "text/csv",
  env: "text/plain",
};

export function inferProjectFileMimeType(fileName) {
  const name = String(fileName || "").trim();
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  return MIME_BY_EXTENSION[ext] || "text/plain";
}

export function buildProjectAttachmentBundleText(project, files) {
  const safeFiles = Array.isArray(files) ? [...files] : [];
  safeFiles.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  let output = `Project: ${project?.name || "Project"}\n`;
  output += `${"=".repeat(40)}\n\n`;
  output += "Directory Tree:\n";
  output += buildProjectTree(safeFiles);
  output += "\n\n========================================\n";

  for (const file of safeFiles) {
    output += `\n\n--- [FILE: ${file.name}] ---\n\n`;
    output += String(file.content || "");
  }

  return output;
}

export function createProjectAttachmentFiles(project, files) {
  const safeFiles = Array.isArray(files)
    ? files.filter((file) => file && typeof file.content === "string")
    : [];

  if (safeFiles.length === 0) {
    return [];
  }

  if (safeFiles.length === 1) {
    return [createNativeProjectFile(safeFiles[0])];
  }

  const bundleText = buildProjectAttachmentBundleText(project, safeFiles);
  const projectSlug = slugify(project?.name || "project");
  return [
    new File([bundleText], `${projectSlug}-project-files.txt`, {
      type: "text/plain",
    }),
  ];
}

export function createNativeProjectFile(projectFile) {
  const downloadName = normalizeAttachmentName(projectFile?.name || "project-file.txt");
  return new File([String(projectFile?.content || "")], downloadName, {
    type: inferProjectFileMimeType(projectFile?.name),
  });
}

export function downloadProjectFile(projectFile) {
  const blob = new Blob([String(projectFile?.content || "")], {
    type: inferProjectFileMimeType(projectFile?.name),
  });
  triggerBlobDownload(blob, projectFile?.name || "project-file.txt");
}

export function downloadAllProjectFiles(project, files) {
  const zipBlob = buildZip(
    (Array.isArray(files) ? files : []).map((file) => ({
      path: file.name,
      content: String(file.content || ""),
    }))
  );

  const zipName = `${slugify(project?.name || "project")}-files-${buildTimestamp()}.zip`;
  triggerBlobDownload(zipBlob, zipName);
}

export function buildSyntheticAttachmentMetadata(project, files, createdFiles) {
  const base = {
    source: "project",
    projectId: project?.id || null,
    projectName: project?.name || "Project",
    projectFileIds: files.map((file) => file.id),
    projectFiles: files.map((file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
    })),
  };

  if (files.length === 1 && createdFiles.length === 1) {
    return [{
      ...base,
      kind: "project-file",
      name: createdFiles[0].name,
      size: createdFiles[0].size,
    }];
  }

  return createdFiles.map((file) => ({
    ...base,
    kind: "project-bundle",
    name: file.name,
    size: file.size,
  }));
}

function buildProjectTree(files) {
  const tree = {};
  for (const file of files) {
    const parts = String(file.name || "file.txt").split("/");
    let cursor = tree;
    for (const part of parts) {
      if (!cursor[part]) {
        cursor[part] = {};
      }
      cursor = cursor[part];
    }
  }

  const lines = [];
  printTree(tree, "", lines);
  return lines.join("\n") || "(empty)";
}

function printTree(node, prefix, lines) {
  const keys = Object.keys(node).sort((a, b) => {
    const aIsDir = Object.keys(node[a]).length > 0;
    const bIsDir = Object.keys(node[b]).length > 0;
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  keys.forEach((key, index) => {
    const isLast = index === keys.length - 1;
    lines.push(`${prefix}${isLast ? "└── " : "├── "}${key}`);
    const next = node[key];
    if (Object.keys(next).length > 0) {
      printTree(next, `${prefix}${isLast ? "    " : "│   "}`, lines);
    }
  });
}

function normalizeAttachmentName(name) {
  return String(name || "project-file.txt")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/[\\/]/g, "__");
}

function slugify(value) {
  return String(value || "project")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}
