/**
 * Folder Reader
 * Prompts user for a directory, recursively reads all readable code/text files,
 * and concatenates them into a single File object.
 */

export async function pickFolderAndConcatenate() {
  const selection = await selectFolderSelection();
  if (!selection) {
    return null;
  }

  const allFiles = selection.files.slice();
  allFiles.sort((a, b) => a.path.localeCompare(b.path));

  // Add file tree at the top
  let concatText = generateTree(allFiles);
  concatText += "\n\n========================================\n\n";
  let textFileCount = 0;

  for (const file of allFiles) {
    if (!isTextFile(file.name)) {
      continue;
    }

    if (file.size > 2 * 1024 * 1024) continue; // skip files > 2MB to avoid freezing

    try {
      const text = await file.text();

      if (text.indexOf("\0") !== -1) {
        continue;
      }

      concatText += `\n\n--- [FILE: ${file.path}] ---\n\n`;
      concatText += text;
      textFileCount += 1;
    } catch (e) {
      console.warn(`Could not read ${file.path}`, e);
    }
  }

  if (!textFileCount) {
    return null;
  }

  const blob = new Blob([concatText], { type: "text/plain" });
  const workspaceName = `${selection.rootName || "folder"}_workspace.txt`;
  return new File([blob], workspaceName, { type: "text/plain" });
}

async function selectFolderSelection() {
  if (supportsDirectoryPicker()) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const files = [];
      await readDirectory(dirHandle, dirHandle.name, files);
      return {
        rootName: dirHandle.name || "folder",
        files,
      };
    } catch (err) {
      if (isAbortError(err)) {
        return null;
      }
      throw err;
    }
  }

  return await selectFolderSelectionWithInput();
}

async function selectFolderSelectionWithInput() {
  if (!supportsDirectoryInput()) {
    throw new Error("Folder uploads are not supported in this browser.");
  }

  return await new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("aria-hidden", "true");
    input.tabIndex = -1;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";

    const cleanup = () => {
      window.removeEventListener("focus", handleWindowFocus);
      input.removeEventListener("change", handleChange);
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    const finish = (value) => {
      cleanup();
      resolve(value);
    };

    const handleChange = () => {
      const files = Array.from(input.files || []);
      if (!files.length) {
        finish(null);
        return;
      }

      const selectedFiles = files
        .map((file) => {
          const relativePath = file.webkitRelativePath || file.name;
          file.path = relativePath;
          return file;
        })
        .filter((file) => shouldKeepPath(file.path));

      finish({
        rootName: inferRootName(selectedFiles),
        files: selectedFiles,
      });
    };

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (input.files && input.files.length) {
          return;
        }

        finish(null);
      }, 0);
    };

    input.addEventListener("change", handleChange, { once: true });
    window.addEventListener("focus", handleWindowFocus, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

async function readDirectory(dirHandle, path, allFiles) {
  try {
    for await (const entry of dirHandle.values()) {
      const entryPath = `${path}/${entry.name}`;
      if (!shouldKeepPath(entryPath)) {
        continue;
      }

      if (entry.kind === "file") {
        try {
          const file = await entry.getFile();
          file.path = entryPath;
          allFiles.push(file);
        } catch (fileErr) {
          console.warn(`Skipping file ${entryPath} due to error:`, fileErr);
        }
      } else if (entry.kind === "directory") {
        await readDirectory(entry, entryPath, allFiles);
      }
    }
  } catch (dirErr) {
    console.warn(`Could not read directory ${path}:`, dirErr);
  }
}

function generateTree(allFiles) {
  const tree = {};
  for (const file of allFiles) {
    if (!isTextFile(file.name)) continue;
    const parts = file.path.split("/");
    let current = tree;
    for (const part of parts) {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
  }

  let output = "Directory Tree:\n";
  
  function printTree(node, prefix = "") {
    const keys = Object.keys(node).sort((a, b) => {
      const aIsDir = Object.keys(node[a]).length > 0;
      const bIsDir = Object.keys(node[b]).length > 0;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const isLast = i === keys.length - 1;
      const marker = isLast ? "└── " : "├── ";
      output += prefix + marker + key + "\n";
      
      const children = node[key];
      if (Object.keys(children).length > 0) {
        printTree(children, prefix + (isLast ? "    " : "│   "));
      }
    }
  }

  printTree(tree);
  return output;
}

function supportsDirectoryPicker() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function supportsDirectoryInput() {
  if (typeof document === "undefined") {
    return false;
  }

  const input = document.createElement("input");
  return "webkitdirectory" in input;
}

function inferRootName(files) {
  if (!files.length) {
    return "folder";
  }

  const firstPath = files[0].path || files[0].webkitRelativePath || files[0].name || "";
  const rootName = firstPath.split("/")[0];
  return rootName || "folder";
}

function shouldKeepPath(path) {
  const segments = String(path || "").split("/");
  for (const segment of segments) {
    if (
      segment === "node_modules" ||
      segment === ".git" ||
      segment === ".github" ||
      segment === "dist" ||
      segment === "build" ||
      segment === ".idea" ||
      segment === ".vscode" ||
      segment === ".vs" ||
      segment === "bin" ||
      segment === "obj" ||
      segment === "out" ||
      segment === "target"
    ) {
      return false;
    }
  }

  return true;
}

function isAbortError(err) {
  return err && (err.name === "AbortError" || err.code === 20);
}

function isTextFile(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const textExts = [
    "js", "ts", "jsx", "tsx", "svelte", "vue", "html", "css", "scss", "json",
    "md", "txt", "py", "c", "cpp", "h", "hpp", "java", "go", "rs", "rb", "php",
    "sh", "yml", "yaml", "toml", "ini", "csv", "sql", "xml", "env",
    "cs", "csproj", "sln", "fs", "fsproj", "razor", "swift", "kt", "dart"
  ];
  return textExts.includes(ext);
}
