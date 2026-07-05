import { createNote, deletePath, renamePath } from "./api";
import {
  getCurrentPath,
  openNote,
  refreshTree,
  setContextMenuHandler,
  setCurrentPath,
  showStatus,
} from "./index";

const UNTITLED_BASE = "無題のノート";
const MAX_UNTITLED = 100;

let menu: HTMLElement | null = null;

function closeMenu(): void {
  menu?.remove();
  menu = null;
}

// --- 新規ノート ---

async function newNote(): Promise<void> {
  for (let n = 1; n <= MAX_UNTITLED; n++) {
    const name = n === 1 ? `${UNTITLED_BASE}.md` : `${UNTITLED_BASE} ${n}.md`;
    try {
      await createNote(name);
      await refreshTree();
      await openNote(name);
      return;
    } catch (e) {
      if (String(e).includes("already exists")) continue;
      console.error("create_note failed:", e);
      showStatus("操作に失敗しました");
      return;
    }
  }
  showStatus("操作に失敗しました");
}

// --- リネーム ---

function startRename(path: string, row: HTMLElement): void {
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
  const baseName = path.slice(dir.length).replace(/\.md$/i, "");

  const input = document.createElement("input");
  input.className = "rename-input";
  input.value = baseName;
  row.replaceChildren(input);
  input.focus();
  input.select();

  let finished = false;
  const cancel = () => {
    if (finished) return;
    finished = true;
    void refreshTree();
  };
  const confirm = async () => {
    if (finished) return;
    const name = input.value.trim();
    if (name === "" || name.includes("/") || name.includes("\\")) return;
    if (name === baseName) {
      cancel();
      return;
    }
    const to = `${dir}${name}.md`;
    try {
      await renamePath(path, to);
      finished = true;
      if (getCurrentPath() === path) setCurrentPath(to);
      await refreshTree();
    } catch (e) {
      if (String(e).includes("already exists")) {
        showStatus("同名のファイルがあります");
      } else {
        console.error("rename_path failed:", e);
        showStatus("操作に失敗しました");
        cancel();
      }
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void confirm();
    if (e.key === "Escape") cancel();
    e.stopPropagation();
  });
  input.addEventListener("blur", cancel);
}

// --- 削除（二段階確認） ---

async function doDelete(path: string): Promise<void> {
  try {
    await deletePath(path);
    if (getCurrentPath() === path) setCurrentPath(null);
    await refreshTree();
  } catch (e) {
    console.error("delete_path failed:", e);
    showStatus("操作に失敗しました");
  }
}

// --- コンテキストメニュー ---

function showMenu(e: MouseEvent, path: string, row: HTMLElement): void {
  e.preventDefault();
  closeMenu();

  menu = document.createElement("div");
  menu.className = "context-menu";

  const rename = document.createElement("button");
  rename.className = "context-menu-item";
  rename.textContent = "リネーム";
  rename.addEventListener("click", () => {
    closeMenu();
    startRename(path, row);
  });

  const del = document.createElement("button");
  del.className = "context-menu-item";
  del.textContent = "削除";
  let confirming = false;
  del.addEventListener("click", () => {
    if (!confirming) {
      confirming = true;
      del.textContent = "本当に削除する";
      del.classList.add("danger");
      return;
    }
    closeMenu();
    void doDelete(path);
  });

  menu.append(rename, del);
  document.body.appendChild(menu);

  // 画面外にはみ出さない位置に表示
  const { innerWidth, innerHeight } = window;
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(e.clientX, innerWidth - rect.width - 4)}px`;
  menu.style.top = `${Math.min(e.clientY, innerHeight - rect.height - 4)}px`;
}

export function initFileOps(): void {
  const header = document.querySelector<HTMLElement>(".sidebar-header");
  if (header) {
    const add = document.createElement("button");
    add.className = "sidebar-add-button";
    add.title = "新規ノート";
    add.textContent = "+";
    add.addEventListener("click", () => void newNote());
    header.appendChild(add);
  }

  setContextMenuHandler(showMenu);

  window.addEventListener("mousedown", (e) => {
    if (menu && !menu.contains(e.target as Node)) closeMenu();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}
