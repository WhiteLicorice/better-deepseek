/**
 * Folder Reader
 * Prompts user for a directory, recursively reads all readable code/text files,
 * and concatenates them into a single File object.
 */

export async function pickFolderAndConcatenate() {
  try {
    const dirHandle = await window.showDirectoryPicker();
    const allFiles = [];
    await readDirectory(dirHandle, dirHandle.name, allFiles);

    // Add file tree at the top
    let concatText = generateTree(allFiles);
    concatText += "\n\n========================================\n\n";

    for (const file of allFiles) {
      if (isTextFile(file.name)) {
        if (file.size > 2 * 1024 * 1024) continue; // skip files > 2MB to avoid freezing
        
        try {
          const text = await file.text();
          
          if (text.indexOf("\0") !== -1) {
            continue;
          }

          concatText += `\n\n--- [FILE: ${file.path}] ---\n\n`;
          concatText += text;
        } catch (e) {
          console.warn(`Could not read ${file.path}`, e);
        }
      }
    }

    if (!concatText || concatText.trim() === "Directory Tree:") {
      return null;
    }

    const blob = new Blob([concatText], { type: "text/plain" });
    const fakeFile = new File([blob], `${dirHandle.name}_workspace.txt`, { type: "text/plain" });
    return fakeFile;
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("[AttachMenu] Folder read error:", err);
    }
    return null;
  }
}

async function readDirectory(dirHandle, path, allFiles) {
  try {
    for await (const entry of dirHandle.values()) {
      const entryPath = `${path}/${entry.name}`;
      if (entry.kind === "file") {
        try {
          const file = await entry.getFile();
          file.path = entryPath;
          allFiles.push(file);
        } catch (fileErr) {
          console.warn(`Skipping file ${entryPath} due to error:`, fileErr);
        }
      } else if (entry.kind === "directory") {
        const name = entry.name;
        if (
          name === "node_modules" || 
          name === ".git" || 
          name === ".github" || 
          name === "dist" || 
          name === "build" || 
          name === ".idea" || 
          name === ".vscode" ||
          name === ".vs" ||
          name === "bin" ||
          name === "obj" ||
          name === "out" ||
          name === "target"
        ) {
          continue;
        }
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
