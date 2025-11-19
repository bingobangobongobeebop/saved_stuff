const storageKey = "snippetKeeperData";

const clone = (value) => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const defaultData = Object.freeze({
  folders: {
    root: {
      id: "root",
      name: "All Snippets",
      parentId: null,
      childrenIds: [],
      snippetIds: [],
    },
  },
  snippets: {},
  rootFolderId: "root",
  selectedFolderId: "root",
  selectedSnippetId: null,
});

const folderTreeEl = document.getElementById("folderTree");
const folderTemplate = document.getElementById("folderTemplate");
const snippetsListEl = document.getElementById("snippetsList");
const snippetTemplate = document.getElementById("snippetTemplate");
const currentFolderNameEl = document.getElementById("currentFolderName");
const snippetTitleEl = document.getElementById("snippetTitle");
const snippetContentEl = document.getElementById("snippetContent");
const snippetFormEl = document.getElementById("snippetForm");
const deleteSnippetBtn = document.getElementById("deleteSnippetBtn");
const copySnippetBtn = document.getElementById("copySnippetBtn");
const statusMessageEl = document.getElementById("statusMessage");
const renameFolderBtn = document.getElementById("renameFolderBtn");
const deleteFolderBtn = document.getElementById("deleteFolderBtn");

const newFolderBtn = document.getElementById("newFolderBtn");
const newSnippetBtn = document.getElementById("newSnippetBtn");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");

let state = loadState();

function ensureValidSelection() {
  if (!state.folders[state.selectedFolderId]) {
    state.selectedFolderId = state.rootFolderId;
  }

  const currentFolder = state.folders[state.selectedFolderId];
  if (currentFolder) {
    currentFolder.snippetIds = currentFolder.snippetIds.filter((id) => state.snippets[id]);
  }

  const selectedSnippet = state.snippets[state.selectedSnippetId];
  if (!selectedSnippet || selectedSnippet.folderId !== state.selectedFolderId) {
    state.selectedSnippetId = currentFolder?.snippetIds.find((id) => state.snippets[id]) ?? null;
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return clone(defaultData);
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid data");
    }
    ensureRootFolder(parsed);
    return {
      ...clone(defaultData),
      ...parsed,
      folders: { ...clone(defaultData.folders), ...parsed.folders },
      snippets: { ...parsed.snippets },
    };
  } catch (error) {
    console.error("Failed to load state", error);
    setStatus("Could not load saved data. Starting fresh.", true);
    return clone(defaultData);
  }
}

function ensureRootFolder(data) {
  if (!data.folders || !data.folders[data.rootFolderId || "root"]) {
    data.folders = clone(defaultData.folders);
    data.rootFolderId = "root";
  }
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to persist state", error);
    setStatus("Unable to save to local storage.", true);
  }
}

function setStatus(message, isError = false) {
  statusMessageEl.textContent = message ?? "";
  statusMessageEl.style.color = isError ? "#ef4444" : "";
  if (message) {
    window.clearTimeout(setStatus.timeoutId);
    setStatus.timeoutId = window.setTimeout(() => {
      statusMessageEl.textContent = "";
    }, 4000);
  }
}

function render() {
  ensureValidSelection();
  renderFolderTree();
  renderSnippetList();
  renderEditor();
}

function renderFolderTree() {
  folderTreeEl.innerHTML = "";
  const rootFolder = state.folders[state.rootFolderId];
  const rootNode = buildFolderNode(rootFolder);
  folderTreeEl.appendChild(rootNode);
}

function buildFolderNode(folder) {
  const node = folderTemplate.content.firstElementChild.cloneNode(true);
  const button = node.querySelector(".folder-button");
  const childrenContainer = node.querySelector(".folder-children");

  button.textContent = `${folder.name} (${folder.snippetIds.length})`;
  button.dataset.folderId = folder.id;
  if (state.selectedFolderId === folder.id) {
    button.classList.add("active");
  }
  button.addEventListener("click", () => {
    selectFolder(folder.id);
  });

  const childFolders = [...folder.childrenIds]
    .map((id) => state.folders[id])
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  childrenContainer.innerHTML = "";
  childFolders.forEach((child) => {
    childrenContainer.appendChild(buildFolderNode(child));
  });

  return node;
}

function renderSnippetList() {
  const folder = state.folders[state.selectedFolderId];
  if (!folder) {
    snippetsListEl.innerHTML = "<p class=\"empty\">Select or create a folder.</p>";
    currentFolderNameEl.textContent = "Snippets";
    return;
  }

  currentFolderNameEl.textContent = folder.name;
  snippetsListEl.innerHTML = "";

  if (!folder.snippetIds.length) {
    snippetsListEl.innerHTML = "<p class=\"empty\">No snippets yet. Create one to get started.</p>";
    return;
  }

  const snippets = folder.snippetIds
    .map((id) => state.snippets[id])
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt));

  snippets.forEach((snippet) => {
    const snippetNode = snippetTemplate.content.firstElementChild.cloneNode(true);
    const button = snippetNode.querySelector(".snippet-button");
    const updated = snippetNode.querySelector(".snippet-updated");

    button.textContent = snippet.title || "Untitled Snippet";
    button.dataset.snippetId = snippet.id;
    if (state.selectedSnippetId === snippet.id) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      selectSnippet(snippet.id);
    });

    const updatedDate = snippet.updatedAt || snippet.createdAt;
    if (updatedDate) {
      const formatted = new Date(updatedDate).toLocaleString();
      updated.textContent = `Updated ${formatted}`;
    } else {
      updated.textContent = "";
    }

    snippetsListEl.appendChild(snippetNode);
  });
}

function renderEditor() {
  const snippet = state.snippets[state.selectedSnippetId];
  const hasSnippet = Boolean(snippet);

  snippetTitleEl.disabled = !hasSnippet;
  snippetContentEl.disabled = !hasSnippet;
  deleteSnippetBtn.disabled = !hasSnippet;
  copySnippetBtn.disabled = !hasSnippet;

  if (!hasSnippet) {
    snippetTitleEl.value = "";
    snippetContentEl.value = "";
    snippetFormEl.querySelector("button[type='submit']").disabled = true;
    return;
  }

  snippetFormEl.querySelector("button[type='submit']").disabled = false;
  snippetTitleEl.value = snippet.title;
  snippetContentEl.value = snippet.content;
}

function selectFolder(folderId) {
  if (!state.folders[folderId]) return;
  state.selectedFolderId = folderId;
  if (!state.folders[folderId].snippetIds.includes(state.selectedSnippetId)) {
    state.selectedSnippetId = state.folders[folderId].snippetIds[0] ?? null;
  }
  persist();
  render();
}

function selectSnippet(snippetId) {
  if (!state.snippets[snippetId]) return;
  state.selectedSnippetId = snippetId;
  persist();
  renderEditor();
  highlightSelectedSnippet(snippetId);
}

function highlightSelectedSnippet(snippetId) {
  snippetsListEl.querySelectorAll(".snippet-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.snippetId === snippetId);
  });
}

function createFolder(parentId, name) {
  const id = crypto.randomUUID?.() ?? `folder-${Date.now()}-${Math.random()}`;
  const folderName = name?.trim() || "New Folder";
  state.folders[id] = {
    id,
    name: folderName,
    parentId,
    childrenIds: [],
    snippetIds: [],
  };
  const parentFolder = state.folders[parentId];
  if (parentFolder && !parentFolder.childrenIds.includes(id)) {
    parentFolder.childrenIds.push(id);
  }
  state.selectedFolderId = id;
  state.selectedSnippetId = null;
  persist();
  render();
  setStatus(`Created folder "${folderName}"`);
}

function handleNewFolder() {
  const parentFolder = state.folders[state.selectedFolderId] ?? state.folders[state.rootFolderId];
  const name = window.prompt("Folder name", "New Folder");
  if (name === null) return;
  createFolder(parentFolder.id, name);
}

function createSnippet(folderId) {
  const folder = state.folders[folderId];
  if (!folder) return;
  const id = crypto.randomUUID?.() ?? `snippet-${Date.now()}-${Math.random()}`;
  const timestamp = new Date().toISOString();
  const snippet = {
    id,
    folderId,
    title: "New Snippet",
    content: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.snippets[id] = snippet;
  folder.snippetIds.unshift(id);
  state.selectedSnippetId = id;
  persist();
  render();
  setStatus("New snippet created.");
  snippetTitleEl.focus();
}

function handleNewSnippet() {
  const folderId = state.selectedFolderId ?? state.rootFolderId;
  createSnippet(folderId);
}

function handleSnippetSave(event) {
  event.preventDefault();
  const snippet = state.snippets[state.selectedSnippetId];
  if (!snippet) return;
  const title = snippetTitleEl.value.trim() || "Untitled Snippet";
  const content = snippetContentEl.value;
  snippet.title = title;
  snippet.content = content;
  snippet.updatedAt = new Date().toISOString();
  persist();
  renderSnippetList();
  setStatus("Snippet saved.");
}

function handleDeleteSnippet() {
  const snippet = state.snippets[state.selectedSnippetId];
  if (!snippet) return;
  const confirmed = window.confirm(`Delete snippet "${snippet.title}"? This cannot be undone.`);
  if (!confirmed) return;

  const folder = state.folders[snippet.folderId];
  if (folder) {
    folder.snippetIds = folder.snippetIds.filter((id) => id !== snippet.id);
  }
  delete state.snippets[snippet.id];

  const nextSnippet = folder?.snippetIds[0] ?? null;
  state.selectedSnippetId = nextSnippet;
  persist();
  render();
  setStatus("Snippet deleted.");
}

function handleCopySnippet() {
  const snippet = state.snippets[state.selectedSnippetId];
  if (!snippet) return;
  navigator.clipboard
    .writeText(snippet.content)
    .then(() => setStatus("Snippet copied to clipboard."))
    .catch((error) => {
      console.error("Clipboard error", error);
      setStatus("Unable to copy to clipboard.", true);
    });
}

function handleRenameFolder() {
  const folder = state.folders[state.selectedFolderId];
  if (!folder || folder.id === state.rootFolderId) {
    if (!folder) {
      setStatus("Select a folder to rename.", true);
    } else {
      setStatus("The root folder cannot be renamed.", true);
    }
    return;
  }
  const newName = window.prompt("New folder name", folder.name);
  if (!newName || !newName.trim()) return;
  folder.name = newName.trim();
  persist();
  renderFolderTree();
  currentFolderNameEl.textContent = folder.name;
  setStatus("Folder renamed.");
}

function collectDescendantFolderIds(folderId) {
  const folder = state.folders[folderId];
  if (!folder) return [];
  return folder.childrenIds.reduce((acc, childId) => {
    acc.push(childId, ...collectDescendantFolderIds(childId));
    return acc;
  }, []);
}

function handleDeleteFolder() {
  const folder = state.folders[state.selectedFolderId];
  if (!folder || folder.id === state.rootFolderId) {
    setStatus("Cannot delete the root folder.", true);
    return;
  }

  const allFolderIds = [folder.id, ...collectDescendantFolderIds(folder.id)];
  const snippetCount = allFolderIds.reduce((count, id) => {
    const f = state.folders[id];
    return count + (f ? f.snippetIds.length : 0);
  }, 0);

  const confirmed = window.confirm(
    `Delete folder "${folder.name}" and ${allFolderIds.length - 1} subfolders containing ${snippetCount} snippet(s)?`
  );
  if (!confirmed) return;

  const parent = state.folders[folder.parentId];
  if (parent) {
    parent.childrenIds = parent.childrenIds.filter((id) => id !== folder.id);
  }

  allFolderIds.forEach((id) => {
    const f = state.folders[id];
    if (!f) return;
    f.snippetIds.forEach((snippetId) => {
      delete state.snippets[snippetId];
    });
    delete state.folders[id];
  });

  state.selectedFolderId = parent?.id ?? state.rootFolderId;
  const nextFolder = state.folders[state.selectedFolderId];
  state.selectedSnippetId = nextFolder?.snippetIds[0] ?? null;
  persist();
  render();
  setStatus("Folder deleted.");
}

function handleExport() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `snippet-keeper-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setStatus("Data exported.");
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const imported = JSON.parse(loadEvent.target.result);
      if (!imported || typeof imported !== "object") {
        throw new Error("Invalid file format");
      }
      ensureRootFolder(imported);
      if (!imported.snippets || !imported.folders) {
        throw new Error("Missing required data fields");
      }
      state = {
        ...clone(defaultData),
        ...imported,
        folders: { ...clone(defaultData.folders), ...imported.folders },
        snippets: { ...imported.snippets },
      };
      if (!state.folders[state.selectedFolderId]) {
        state.selectedFolderId = state.rootFolderId;
      }
      if (!state.snippets[state.selectedSnippetId]) {
        const folder = state.folders[state.selectedFolderId];
        state.selectedSnippetId = folder?.snippetIds[0] ?? null;
      }
      persist();
      render();
      setStatus("Import successful.");
    } catch (error) {
      console.error("Import failed", error);
      setStatus("Unable to import file.", true);
    } finally {
      event.target.value = "";
    }
  };
  reader.onerror = () => {
    setStatus("Failed to read the selected file.", true);
    event.target.value = "";
  };
  reader.readAsText(file);
}

newFolderBtn.addEventListener("click", handleNewFolder);
newSnippetBtn.addEventListener("click", handleNewSnippet);
snippetFormEl.addEventListener("submit", handleSnippetSave);
deleteSnippetBtn.addEventListener("click", handleDeleteSnippet);
copySnippetBtn.addEventListener("click", handleCopySnippet);
renameFolderBtn.addEventListener("click", handleRenameFolder);
deleteFolderBtn.addEventListener("click", handleDeleteFolder);
exportBtn.addEventListener("click", handleExport);
importInput.addEventListener("change", handleImport);

render();
