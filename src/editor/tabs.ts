/**
 * エディタ上部のタブ（Obsidian のタブ相当）。
 *
 * ここは保管庫を知らない。ノートのパスは不透明なキーとして受け取るだけで、
 * タブのクリック・×・中クリック・キー操作は状態を変えずに onSelect / onClose へ委ねる。
 * 保存の確定を挟んでから activate / close を呼ぶのは file-explorer 側の責務（editor/tabs の design.md）。
 */
import type { EditorHandle, EditorSession } from "./index";
import { displayName } from "./inline-title";

export interface TabsOptions {
  /** タブのクリック、Ctrl+Tab / Ctrl+Shift+Tab の移動先 */
  onSelect: (key: string) => void;
  /** ×・タブの中クリック・Ctrl+W */
  onClose: (key: string) => void;
}

export interface TabsHandle {
  keys(): string[];
  active(): string | null;
  has(key: string): boolean;
  /** アクティブなタブの右に新しいタブを作り、content で表示する */
  openNew(key: string, content: string): void;
  /** アクティブなタブを key / content に置き換える。タブが無ければ openNew と同じ */
  replaceActive(key: string, content: string): void;
  /** 既存のタブへ切り替える。現在のタブの状態は退避する */
  activate(key: string): void;
  /** タブを閉じる。アクティブなら右隣（無ければ左隣）へ、残りが無ければスクラッチに戻す */
  close(key: string): void;
  closeAll(): void;
  /** すべてのキーを付け替える（リネーム・移動の追随） */
  remap(fn: (key: string) => string): void;
}

interface Tab {
  key: string;
  /** アクティブなタブは null（実体はエディタにある） */
  session: EditorSession | null;
}

export function mountTabs(
  bar: HTMLElement,
  editor: EditorHandle,
  options: TabsOptions,
): TabsHandle {
  let tabs: Tab[] = [];
  let activeKey: string | null = null;

  const indexOf = (key: string) => tabs.findIndex((t) => t.key === key);

  /** アクティブなタブの状態をエディタから退避する */
  function stashActive(): void {
    const tab = activeKey === null ? undefined : tabs[indexOf(activeKey)];
    if (tab) tab.session = editor.saveSession();
  }

  function show(tab: Tab): void {
    activeKey = tab.key;
    if (tab.session) editor.restoreSession(tab.session);
    tab.session = null;
  }

  function render(): void {
    bar.textContent = "";
    for (const tab of tabs) {
      const el = document.createElement("div");
      el.className = "tab";
      if (tab.key === activeKey) el.classList.add("active");
      el.title = tab.key;

      const label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = displayName(tab.key);

      const close = document.createElement("button");
      close.className = "tab-close";
      close.textContent = "×";
      close.title = "閉じる (Ctrl+W)";
      close.addEventListener("click", (e) => {
        e.stopPropagation(); // × は切り替えを伴わない
        options.onClose(tab.key);
      });

      el.append(label, close);
      el.addEventListener("click", () => {
        if (tab.key !== activeKey) options.onSelect(tab.key);
      });
      // WebView2 は中ボタンの mousedown で自動スクロールを始めるため抑止する
      el.addEventListener("mousedown", (e) => {
        if (e.button === 1) e.preventDefault();
      });
      el.addEventListener("auxclick", (e) => {
        if (e.button === 1) options.onClose(tab.key);
      });
      bar.appendChild(el);
      if (tab.key === activeKey) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  function openNew(key: string, content: string): void {
    stashActive();
    const at = activeKey === null ? tabs.length : indexOf(activeKey) + 1;
    tabs.splice(at, 0, { key, session: null });
    activeKey = key;
    editor.setContent(content);
    render();
  }

  // フォーカスがエディタ外（inline-title・ツリー）にあっても効かせるためウィンドウで拾う
  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey || e.altKey || activeKey === null) return;
    // 名前の入力中（inline-title・ツリーのリネーム）に閉じると、入力が黙って捨てられる
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "Tab") {
      e.preventDefault();
      if (tabs.length < 2) return;
      const step = e.shiftKey ? -1 : 1;
      const next = (indexOf(activeKey) + step + tabs.length) % tabs.length;
      options.onSelect(tabs[next].key);
    } else if (!e.shiftKey && e.key.toLowerCase() === "w") {
      e.preventDefault();
      options.onClose(activeKey);
    }
  });

  render();

  return {
    keys: () => tabs.map((t) => t.key),
    active: () => activeKey,
    has: (key) => indexOf(key) !== -1,
    openNew,
    replaceActive: (key, content) => {
      const i = activeKey === null ? -1 : indexOf(activeKey);
      if (i === -1) {
        openNew(key, content);
        return;
      }
      tabs[i] = { key, session: null };
      activeKey = key;
      editor.setContent(content);
      render();
    },
    activate: (key) => {
      const i = indexOf(key);
      if (i === -1 || key === activeKey) return;
      stashActive();
      show(tabs[i]);
      render();
    },
    close: (key) => {
      const i = indexOf(key);
      if (i === -1) return;
      tabs.splice(i, 1);
      if (key === activeKey) {
        const next = tabs[i] ?? tabs[i - 1];
        if (next) {
          show(next);
        } else {
          activeKey = null;
          editor.setContent("");
        }
      }
      render();
    },
    closeAll: () => {
      tabs = [];
      activeKey = null;
      editor.setContent("");
      render();
    },
    remap: (fn) => {
      for (const tab of tabs) tab.key = fn(tab.key);
      if (activeKey !== null) activeKey = fn(activeKey);
      render();
    },
  };
}
