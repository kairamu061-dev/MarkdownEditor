import type { EditorHandle } from "../editor";
import { getSettings } from "../settings/api";
import {
  initialVault,
  listTree,
  movePath,
  openVault,
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
  /** ドラッグ中のノート/フォルダの相対パス（DnD 移動用） */
  dragPath: string | null;
}

const state: ExplorerState = {
  vault: null,
  currentPath: null,
  saveTimer: null,
  pendingContent: null,
  collapsedDirs: new Set(),
  dragPath: null,
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

/** path が "" のときは保管庫ルートを表す（空白部の右クリック） */
type ContextMenuHandler = (
  e: MouseEvent,
  path: string,
  isDir: boolean,
  row: HTMLElement,
) => void;
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

// --- ドラッグ&ドロップ（移動） ---

function parentDir(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

/** 保管庫相対パス（/ 区切り）と OS 絶対パス（Windows は \ 区切り）の両方に対応（BUG-003） */
function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** ドラッグ中の項目を toDir（"" はルート）へドロップ可能か */
function canDrop(toDir: string): boolean {
  const from = state.dragPath;
  if (from === null) return false;
  if (toDir === from || toDir.startsWith(`${from}/`)) return false; // 自身・子孫は不可
  if (toDir === parentDir(from)) return false; // 既に同じ場所
  return true;
}

function makeDraggable(row: HTMLElement, path: string): void {
  row.draggable = true;
  row.addEventListener("dragstart", (e) => {
    state.dragPath = path;
    e.dataTransfer?.setData("text/plain", path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    e.stopPropagation();
  });
  row.addEventListener("dragend", () => {
    state.dragPath = null;
  });
}

/** row を toDir へのドロップ先にする（folder 行・ルート共通） */
function makeDropTarget(row: HTMLElement, toDir: string): void {
  row.addEventListener("dragover", (e) => {
    if (!canDrop(toDir)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    row.classList.add("drop-target");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
  row.addEventListener("drop", (e) => {
    row.classList.remove("drop-target");
    if (!canDrop(toDir)) return;
    e.preventDefault();
    e.stopPropagation();
    const from = state.dragPath;
    if (from !== null) void doMove(from, toDir);
  });
}

/** 移動に伴い、開閉状態と現在ノートのパスを新しい場所へ付け替える */
function remapPaths(from: string, toDir: string): void {
  const newPath = (toDir ? `${toDir}/` : "") + basename(from);
  const remap = (p: string): string =>
    p === from ? newPath : p.startsWith(`${from}/`) ? newPath + p.slice(from.length) : p;
  state.collapsedDirs = new Set([...state.collapsedDirs].map(remap));
  if (state.currentPath !== null) state.currentPath = remap(state.currentPath);
}

async function doMove(from: string, toDir: string): Promise<void> {
  try {
    await movePath(from, toDir);
    remapPaths(from, toDir);
    await refreshTree();
  } catch (e) {
    if (String(e).includes("already exists")) {
      showStatus("移動先に同名の項目があります");
    } else {
      console.error("move_path failed:", e);
      showStatus("移動に失敗しました");
    }
  }
}

// --- ツリー描画 ---

function renderNodes(nodes: TreeNode[]): HTMLUListElement {
  const ul = document.createElement("ul");
  for (const node of nodes) {
    const li = document.createElement("li");
    li.className = "tree-item";

    const row = document.createElement("div");
    row.className = node.isDir ? "tree-row is-dir" : "tree-row is-file";
    row.dataset.path = node.path;
    row.dataset.isDir = String(node.isDir);
    makeDraggable(row, node.path);
    row.addEventListener("contextmenu", (e) => {
      contextMenuHandler?.(e, node.path, node.isDir, row);
    });

    const chevron = document.createElement("span");
    chevron.className = "tree-chevron";
    row.appendChild(chevron);

    const label = document.createElement("span");
    label.className = "tree-label";
    row.appendChild(label);

    if (node.isDir) {
      const collapsed = state.collapsedDirs.has(node.path);
      chevron.textContent = collapsed ? "▸" : "▾";
      label.textContent = node.name;
      if (collapsed) li.classList.add("collapsed");
      row.addEventListener("click", () => {
        const nowCollapsed = li.classList.toggle("collapsed");
        chevron.textContent = nowCollapsed ? "▸" : "▾";
        if (nowCollapsed) state.collapsedDirs.add(node.path);
        else state.collapsedDirs.delete(node.path);
      });
      makeDropTarget(row, node.path);
      li.appendChild(row);
      li.appendChild(renderNodes(node.children));
    } else {
      chevron.textContent = ""; // ノートは開閉マークなし（位置合わせ用スペーサ）
      label.textContent = node.name.replace(/\.md$/i, "");
      if (node.path === state.currentPath) row.classList.add("active");
      row.addEventListener("click", () => void openNote(node.path));
      li.appendChild(row);
    }
    ul.appendChild(li);
  }
  return ul;
}

function renderTree(): void {
  if (!state.vault) return;
  renderVaultSwitcher(state.vault.name);

  let tree = container.querySelector<HTMLElement>(".tree");
  if (!tree) {
    container.textContent = "";
    const treeEl = document.createElement("div");
    treeEl.className = "tree";
    // ツリー空白部（行の外）だけをルート（""）へのドロップ先・右クリック対象にする。
    // 行の上ではフォルダ行側のハンドラに委ねる（二重ハイライトを避ける）
    treeEl.addEventListener("dragover", (e) => {
      if (e.target !== treeEl || !canDrop("")) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      treeEl.classList.add("drop-target");
    });
    treeEl.addEventListener("dragleave", (e) => {
      if (e.target === treeEl) treeEl.classList.remove("drop-target");
    });
    treeEl.addEventListener("drop", (e) => {
      treeEl.classList.remove("drop-target");
      if (e.target !== treeEl || !canDrop("")) return;
      e.preventDefault();
      const from = state.dragPath;
      if (from !== null) void doMove(from, "");
    });
    treeEl.addEventListener("contextmenu", (e) => {
      if (e.target === treeEl) contextMenuHandler?.(e, "", true, treeEl);
    });
    container.appendChild(treeEl);
    tree = treeEl;
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
  button.textContent = "保管庫を開く";
  button.addEventListener("click", () => void openVaultByDialog());
  empty.appendChild(button);
  container.appendChild(empty);
}

/** 別の保管庫へ切り替える。開いていたノートと開閉状態はリセットする */
function applyVault(info: VaultInfo): void {
  state.vault = info;
  state.currentPath = null;
  state.pendingContent = null;
  state.collapsedDirs = new Set();
  editor.setContent("");
  renderTree();
}

async function openVaultByDialog(): Promise<void> {
  try {
    const info = await pickVault();
    if (info) applyVault(info);
  } catch (e) {
    console.error("pick_vault failed:", e);
    showStatus("保管庫を開けませんでした");
  }
}

async function switchToVault(path: string): Promise<void> {
  try {
    applyVault(await openVault(path));
  } catch (e) {
    console.error("open_vault failed:", e);
    showStatus("保管庫を開けませんでした");
  }
}

// --- 保管庫スイッチャ（Obsidian 風のプルダウン） ---

let switcherMenu: HTMLElement | null = null;

export function closeSwitcher(): void {
  switcherMenu?.remove();
  switcherMenu = null;
}

async function openSwitcher(anchor: HTMLElement): Promise<void> {
  closeSwitcher();
  const settings = await getSettings().catch(() => null);
  const recents = settings?.recentVaults ?? [];
  const current = settings?.lastVault ?? null;

  const menu = document.createElement("div");
  menu.className = "vault-switcher-menu";

  for (const path of recents) {
    const item = document.createElement("button");
    item.className = "vault-switcher-item";
    if (path === current) item.classList.add("current");
    item.textContent = basename(path);
    item.title = path;
    item.addEventListener("click", () => {
      closeSwitcher();
      if (path !== current) void switchToVault(path);
    });
    menu.appendChild(item);
  }

  if (recents.length > 0) {
    const sep = document.createElement("div");
    sep.className = "vault-switcher-sep";
    menu.appendChild(sep);
  }

  const openOther = document.createElement("button");
  openOther.className = "vault-switcher-item";
  openOther.textContent = "別の保管庫を開く…";
  openOther.addEventListener("click", () => {
    closeSwitcher();
    void openVaultByDialog();
  });
  menu.appendChild(openOther);

  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 2}px`;
  menu.style.minWidth = `${rect.width}px`;
  switcherMenu = menu;
  document.body.appendChild(menu);
}

function renderVaultSwitcher(name: string): void {
  const title = document.querySelector<HTMLElement>(".sidebar-title");
  if (!title) return;
  title.textContent = "";
  title.classList.add("vault-switcher");

  const button = document.createElement("button");
  button.className = "vault-switcher-button";
  button.title = "保管庫を切り替える";

  const label = document.createElement("span");
  label.className = "vault-switcher-name";
  label.textContent = name;

  const caret = document.createElement("span");
  caret.className = "vault-switcher-caret";
  caret.textContent = "⌄";

  button.append(label, caret);
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    if (switcherMenu) closeSwitcher();
    else void openSwitcher(button);
  });
  title.appendChild(button);
}

// --- 初期化 ---

export function explorerDocChanged(content: string): void {
  scheduleSave(content);
}

export function initExplorer(el: HTMLElement, editorHandle: EditorHandle): void {
  container = el;
  editor = editorHandle;
  container.style.position = "relative";

  // サイドバー内では WebView2 の既定コンテキストメニューを出さない（BUG-004）。
  // アプリ独自メニューの表示はバブリング中の各ハンドラが担う
  document
    .getElementById("sidebar")
    ?.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      state.pendingContent = editor.getContent();
      void flushSave();
    }
    if (e.key === "Escape") closeSwitcher();
  });
  window.addEventListener("mousedown", (e) => {
    const target = e.target as Node;
    if (
      !(target instanceof Element) ||
      !target.closest(".vault-switcher-menu, .vault-switcher-button")
    ) {
      closeSwitcher();
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
