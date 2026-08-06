/**
 * エディタ最上部のノート名表示（Obsidian のインラインタイトル相当）。
 *
 * ここは保管庫を知らない。表示名の算出と入力 UI だけを持ち、確定は onRename に委譲する
 * （editor 配下は保管庫の知識を持たない方針。wikilink / live-preview と同じ）。
 */

export interface InlineTitleOptions {
  /** 確定時に呼ばれる。成功なら true、失敗（入力を残して再試行させたい）なら false */
  onRename: (newBaseName: string) => Promise<boolean>;
  /** 確定・破棄のあとにフォーカスを戻す先 */
  onDone: () => void;
}

export interface InlineTitleHandle {
  /** 表示を更新する。null はスクラッチ文書（「無題」・編集不可） */
  setPath(relPath: string | null): void;
}

const UNTITLED = "無題";

/** 保管庫相対パスから表示名を作る。ツリーのリネームと同じ規則（file-ops の baseName） */
function displayName(relPath: string): string {
  const dir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/") + 1) : "";
  return relPath.slice(dir.length).replace(/\.md$/i, "");
}

/** ツリーのリネームと同じ検証（空・パス区切りは不可）。フォルダ移動は D&D の役割 */
function isValidName(name: string): boolean {
  return name !== "" && !name.includes("/") && !name.includes("\\");
}

export function mountInlineTitle(
  host: HTMLElement,
  options: InlineTitleOptions,
): InlineTitleHandle {
  let currentPath: string | null = null;
  let editing = false;

  const label = document.createElement("div");
  label.className = "note-title-label";
  label.addEventListener("click", () => {
    if (currentPath !== null) startEdit();
  });

  function render(): void {
    editing = false;
    label.textContent = currentPath === null ? UNTITLED : displayName(currentPath);
    label.classList.toggle("note-title-empty", currentPath === null);
    label.title = currentPath ?? "";
    host.replaceChildren(label);
  }

  function startEdit(): void {
    if (editing || currentPath === null) return;
    editing = true;
    const baseName = displayName(currentPath);

    const input = document.createElement("input");
    input.className = "note-title-input";
    input.value = baseName;
    host.replaceChildren(input);
    input.focus();
    input.select();

    let finished = false;
    let submitting = false;

    const cancel = (): void => {
      if (finished) return;
      finished = true;
      render();
      options.onDone();
    };

    const confirm = async (): Promise<void> => {
      if (finished || submitting) return;
      const name = input.value.trim();
      if (!isValidName(name)) return; // 入力を残して修正させる
      if (name === baseName) {
        cancel();
        return;
      }
      submitting = true;
      const ok = await options.onRename(name);
      if (ok) {
        finished = true;
        // 成功時の表示更新は setPath（購読経由）が行うので、ここでは編集状態だけ畳む
        if (host.contains(input)) render();
        options.onDone();
      } else {
        submitting = false; // 失敗時は入力を残して再試行させる
        // blur 起因の失敗でフォーカスを奪い返すと、外をクリックするたびに
        // blur → 失敗 → 再フォーカスが繰り返されて抜け出せなくなる。
        // まだ入力欄にフォーカスがある（Enter 経由）ときだけ選択し直す
        if (document.activeElement === input) input.select();
      }
    };

    // 画面外クリックは、妥当で変更ありなら確定・それ以外はキャンセル（ツリーのリネームと同方針・BUG-016）。
    // 無条件キャンセルにすると入力した名前が黙って破棄される
    const commitFromBlur = (): void => {
      if (finished || submitting) return;
      const name = input.value.trim();
      if (isValidName(name) && name !== baseName) {
        void confirm();
      } else {
        cancel();
      }
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void confirm();
      if (e.key === "Escape") cancel();
      e.stopPropagation(); // エディタのキーバインドに奪われないように
    });
    input.addEventListener("blur", commitFromBlur);
  }

  render();

  return {
    setPath(relPath: string | null): void {
      currentPath = relPath;
      if (!editing) render();
    },
  };
}
