import type { EditorHandle } from "../editor";
import {
  initialVault,
  listTree,
  pickVault,
  readNote,
  writeNote,
  type TreeNode,
  type VaultInfo,
} from "./api";
import { initFileOps } from "./file-ops";

const SAVE_DEBOUNCE_MS = 700;

interface ExplorerState {
  vault: VaultInfo | null;
  currentPath: string | null;
  saveTimer: number | null;
  pendingContent: string | null;
  /** 折りたたまれているフォルダの相対パス。再描画をまたいで開閉状態を保持する（BUG-002） */
  collapsedDirs: Set<string>;
}

const state: ExplorerState = {
  vault: null,
  currentPath: null,
  saveTimer: null,
  pendingContent: null,
  collapsedDirs: new Set(),
};

let container: HTMLElement;
let editor: EditorHandle;
let statusTimer: number | null = null;

export function showStatus(message: string): void {
  let status = container.querySelector<HTMLElement>(".explorer-status");
  if (!status) {
    status = document.createElement("div");
    status.className = "explorer-status";
    container.appendChild(status);
  }
  status.textContent = message;
  status.hidden = false;
  if (statusTimer !== null) clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    status!.hidden = true;
  }, 4000);
}

// --- 保存 ---

function scheduleSave(content: string): void {
  if (state.currentPath === null) return; // スクラッチ文書は保存しない
  state.pendingContent = content;
  if (state.saveTimer !== null) clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
}

async function flushSave(): Promise<void> {
  if (state.saveTimer !== null) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  if (state.currentPath === null || state.pendingContent === null) return;
  const path = state.currentPath;
  const content = state.pendingContent;
  state.pendingContent = null;
  try {
    await writeNote(path, content);
  } catch (e) {
    console.error("write_note failed:", e);
    state.pendingContent = content; // 保持して次の変更で再試行
    showStatus("保存に失敗しました");
  }
}

// --- file-ops 向け公開フック ---

export function getCurrentPath(): string | null {
  return state.currentPath;
}

/** リネーム追随用。null はスクラッチ扱いに戻す（file-ops の削除時） */
export function setCurrentPath(path: string | null): void {
  state.currentPath = path;
  if (path === null) {
    state.pendingContent = null;
    editor.setContent("");
  }
  renderTree();
}

export async function refreshTree(): Promise<void> {
  if (!state.vault) return;
  try {
    state.vault.tree = await listTree();
    renderTree();
  } catch (e) {
    console.error("list_tree failed:", e);
  }
}

/** wikilink 用。`名前.md` に一致する最初のノートを開く（大文字小文字無視・深さ優先） */
export async function openNoteByName(name: string): Promise<void> {
  const wanted = `${name}.md`.toLowerCase();
  const find = (nodes: TreeNode[]): string | null => {
    for (const node of nodes) {
      if (node.isDir) {
        const hit = find(node.children);
        if (hit) return hit;
      } else if (node.name.toLowerCase() === wanted) {
        return node.path;
      }
    }
    return null;
  };
  const path = state.vault ? find(state.vault.tree) : null;
  if (path) {
    await openNote(path);
  } else {
    showStatus(`ノートが見つかりません: ${name}`);
  }
}

type ContextMenuHandler = (e: MouseEvent, path: string, row: HTMLElement) => void;
let contextMenuHandler: ContextMenuHandler | null = null;

export function setContextMenuHandler(handler: ContextMenuHandler): void {
  contextMenuHandler = handler;
}

// --- ノートを開く ---

export async function openNote(relPath: string): Promise<void> {
  await flushSave();
  try {
    const content = await readNote(relPath);
    state.currentPath = relPath;
    state.pendingContent = null;
    editor.setContent(content);
    editor.focus();
    renderTree();
  } catch (e) {
    console.error("read_note failed:", e);
    showStatus("読み込みに失敗しました");
  }
}

// --- ツリー描画 ---

function renderNodes(nodes: TreeNode[]): HTMLUListElement {
  const ul = document.createElement("ul");
  for (const node of nodes) {
    const li = document.createElement("li");
    li.className = "tree-item";

    const row = document.createElement("div");
    row.className = "tree-row";
    row.dataset.path = node.path;
    row.dataset.isDir = String(node.isDir);

    if (node.isDir) {
      const collapsed = state.collapsedDirs.has(node.path);
      const icon = document.createElement("span");
      icon.className = "tree-folder-icon";
      icon.textContent = collapsed ? "▸" : "▾";
      row.appendChild(icon);
      row.appendChild(document.createTextNode(node.name));
      if (collapsed) li.classList.add("collapsed");
      row.addEventListener("click", () => {
        const nowCollapsed = li.classList.toggle("collapsed");
        icon.textContent = nowCollapsed ? "▸" : "▾";
        if (nowCollapsed) state.collapsedDirs.add(node.path);
        else state.collapsedDirs.delete(node.path);
      });
      li.appendChild(row);
      li.appendChild(renderNodes(node.children));
    } else {
      row.appendChild(document.createTextNode(node.name.replace(/\.md$/i, "")));
      if (node.path === state.currentPath) row.classList.add("active");
      row.addEventListener("click", () => void openNote(node.path));
      row.addEventListener("contextmenu", (e) => {
        contextMenuHandler?.(e, node.path, row);
      });
      li.appendChild(row);
    }
    ul.appendChild(li);
  }
  return ul;
}

function renderTree(): void {
  if (!state.vault) return;
  const title = document.querySelector<HTMLElement>(".sidebar-title");
  if (title) title.textContent = state.vault.name;

  let tree = container.querySelector<HTMLElement>(".tree");
  if (!tree) {
    container.textContent = "";
    tree = document.createElement("div");
    tree.className = "tree";
    container.appendChild(tree);
  }
  tree.textContent = "";
  tree.appendChild(renderNodes(state.vault.tree));
}

function renderEmpty(): void {
  container.textContent = "";
  const empty = document.createElement("div");
  empty.className = "vault-empty";
  const button = document.createElement("button");
  button.className = "vault-open-button";
  button.textContent = "ヴォールトを開く";
  button.addEventListener("click", () => void openVaultByDialog());
  empty.appendChild(button);
  container.appendChild(empty);
}

async function openVaultByDialog(): Promise<void> {
  const info = await pickVault();
  if (info) {
    state.vault = info;
    renderTree();
  }
}

// --- 初期化 ---

export function explorerDocChanged(content: string): void {
  scheduleSave(content);
}

export function initExplorer(el: HTMLElement, editorHandle: EditorHandle): void {
  container = el;
  editor = editorHandle;
  container.style.position = "relative";

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      state.pendingContent = editor.getContent();
      void flushSave();
    }
  });

  initFileOps();
  renderEmpty();
  void initialVault()
    .then((info) => {
      if (info) {
        state.vault = info;
        renderTree();
      }
    })
    .catch((e) => console.error("initial_vault failed:", e));
}
