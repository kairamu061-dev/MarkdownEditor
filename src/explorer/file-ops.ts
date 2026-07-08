import { createFolder, createNote, deletePath, renamePath } from "./api";
import {
  getCurrentPath,
  openNote,
  refreshTree,
  setContextMenuHandler,
  setCurrentPath,
  showStatus,
} from "./index";

const UNTITLED_NOTE = "無題のノート";
const UNTITLED_FOLDER = "新規フォルダ";
const MAX_UNTITLED = 100;

let menu: HTMLElement | null = null;

function closeMenu(): void {
  menu?.remove();
  menu = null;
}

function parentDir(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

function join(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

// --- 新規作成（ノート / フォルダ） ---

/** dir 配下（"" はルート）に連番付きの一意名で新規ノートを作り、開く */
async function newNote(dir: string): Promise<void> {
  for (let n = 1; n <= MAX_UNTITLED; n++) {
    const name = n === 1 ? `${UNTITLED_NOTE}.md` : `${UNTITLED_NOTE} ${n}.md`;
    const rel = join(dir, name);
    try {
      await createNote(rel);
      await refreshTree();
      await openNote(rel);
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

/** dir 配下（"" はルート）に連番付きの一意名で新規フォルダを作る */
async function newFolder(dir: string): Promise<void> {
  for (let n = 1; n <= MAX_UNTITLED; n++) {
    const name = n === 1 ? UNTITLED_FOLDER : `${UNTITLED_FOLDER} ${n}`;
    const rel = join(dir, name);
    try {
      await createFolder(rel);
      await refreshTree();
      return;
    } catch (e) {
      if (String(e).includes("already exists")) continue;
      console.error("create_folder failed:", e);
      showStatus("操作に失敗しました");
      return;
    }
  }
  showStatus("操作に失敗しました");
}

// --- リネーム（ノート / フォルダ） ---

function startRename(path: string, isDir: boolean, row: HTMLElement): void {
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
  const baseName = isDir
    ? path.slice(dir.length)
    : path.slice(dir.length).replace(/\.md$/i, "");

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
    const to = isDir ? `${dir}${name}` : `${dir}${name}.md`;
    try {
      await renamePath(path, to);
      finished = true;
      if (!isDir && getCurrentPath() === path) setCurrentPath(to);
      await refreshTree();
    } catch (e) {
      if (String(e).includes("already exists")) {
        showStatus("同名の項目があります");
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

// --- 削除（二段階確認・ノート / フォルダ） ---

async function doDelete(path: string): Promise<void> {
  try {
    await deletePath(path);
    // 開いているノートが削除対象（またはその配下）ならスクラッチに戻す
    const current = getCurrentPath();
    if (current !== null && (current === path || current.startsWith(`${path}/`))) {
      setCurrentPath(null);
    }
    await refreshTree();
  } catch (e) {
    console.error("delete_path failed:", e);
    showStatus("操作に失敗しました");
  }
}

// --- コンテキストメニュー ---

function addItem(label: string, onClick: () => void): HTMLButtonElement {
  const item = document.createElement("button");
  item.className = "context-menu-item";
  item.textContent = label;
  item.addEventListener("click", onClick);
  return item;
}

function showMenu(e: MouseEvent, path: string, isDir: boolean, row: HTMLElement): void {
  e.preventDefault();
  closeMenu();

  menu = document.createElement("div");
  menu.className = "context-menu";

  // 作成先: フォルダ上ならその中、ノート上なら同じ親、空白部ならルート
  const targetDir = isDir ? path : parentDir(path);
  menu.append(
    addItem("新規ノート", () => {
      closeMenu();
      void newNote(targetDir);
    }),
    addItem("新規フォルダ", () => {
      closeMenu();
      void newFolder(targetDir);
    }),
  );

  // ルート（path === ""）にはリネーム/削除を出さない
  if (path !== "") {
    const rename = addItem("リネーム", () => {
      closeMenu();
      startRename(path, isDir, row);
    });

    const del = document.createElement("button");
    del.className = "context-menu-item";
    del.textContent = "削除";
    let confirming = false;
    del.addEventListener("click", () => {
      if (!confirming) {
        confirming = true;
        del.textContent = isDir ? "フォルダごと削除する" : "本当に削除する";
        del.classList.add("danger");
        return;
      }
      closeMenu();
      void doDelete(path);
    });

    menu.append(rename, del);
  }

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
    add.addEventListener("click", () => void newNote(""));
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
