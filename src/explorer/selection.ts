// ノートの複数選択と範囲選択（マーキー）。
// index.ts を import しない（循環を避ける）。選択が変わったら行の .selected を自分で付け直す

/** 選択中のノートの保管庫相対パス */
const selected = new Set<string>();

let root: HTMLElement | null = null;

export function isSelected(path: string): boolean {
  return selected.has(path);
}

export function selectedPaths(): string[] {
  return [...selected];
}

export function toggleSelected(path: string): void {
  if (!selected.delete(path)) selected.add(path);
  paint();
}

export function clearSelection(): void {
  if (selected.size === 0) return;
  selected.clear();
  paint();
}

/** 移動・リネームで変わったパスへ付け替える */
export function remapSelection(remap: (p: string) => string): void {
  const next = [...selected].map(remap);
  selected.clear();
  for (const p of next) selected.add(p);
}

/** ツリーに存在しないパス（削除・外部での変更）を選択から外す */
export function retainSelection(exists: Set<string>): void {
  for (const p of selected) if (!exists.has(p)) selected.delete(p);
}

function paint(): void {
  root?.querySelectorAll<HTMLElement>(".tree-row.is-file").forEach((row) => {
    row.classList.toggle("selected", selected.has(row.dataset.path ?? ""));
  });
}

// --- 範囲選択 ---------------------------------------------------------------

/** この距離（px）以上動かしたら範囲選択とみなす。未満はただのクリック */
const DRAG_THRESHOLD = 4;
/** ポインタがこの距離（px）まで上下端に寄ったら自動スクロールする */
const EDGE = 24;
const SCROLL_STEP = 8;

interface Point {
  x: number;
  y: number;
}

/** container の中のコンテンツ座標（スクロール量を含む） */
function toContent(container: HTMLElement, clientX: number, clientY: number): Point {
  const rect = container.getBoundingClientRect();
  return {
    x: clientX - rect.left + container.scrollLeft,
    y: clientY - rect.top + container.scrollTop,
  };
}

export function initMarquee(container: HTMLElement): void {
  root = container;
  let suppressClick = false;

  // 範囲選択を終えた直後の click を 1 回だけ止める（離した位置のノートが開かないように）
  container.addEventListener(
    "click",
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );

  container.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target?.closest(".tree")) return;
    // 名前・開閉マークの上は従来どおり（クリック = 開く / 開閉、ドラッグ = 移動）。
    // リネーム・新規作成の入力欄（file-ops が行の中身と差し替える）も、カーソル操作を妨げない
    if (target.closest(".tree-label, .tree-chevron, input, textarea, [contenteditable]")) return;
    // 下の preventDefault でフォーカスが動かなくなる。入力欄の blur で確定する file-ops の
    // リネームが、空白のクリックで確定しなくなるので、ここで明示的に外す
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && container.contains(focused)) focused.blur();
    // 行は draggable なので、止めないと行の空白からネイティブ DnD が始まる。
    // 文字列の選択も止まる。click はこの影響を受けない
    e.preventDefault();

    const additive = e.ctrlKey;
    const base = additive ? new Set(selected) : new Set<string>();
    const start = toContent(container, e.clientX, e.clientY);
    const startClient = { x: e.clientX, y: e.clientY };
    let last = startClient;
    let box: HTMLDivElement | null = null;
    let scrollTimer: number | null = null;

    const update = (): void => {
      if (!box) return;
      const cur = toContent(container, last.x, last.y);
      const left = Math.min(start.x, cur.x);
      const top = Math.min(start.y, cur.y);
      const right = Math.max(start.x, cur.x);
      const bottom = Math.max(start.y, cur.y);
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${right - left}px`;
      box.style.height = `${bottom - top}px`;

      selected.clear();
      for (const p of base) selected.add(p);
      container.querySelectorAll<HTMLElement>(".tree-row.is-file").forEach((row) => {
        const r = row.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return; // 折りたたまれたフォルダの中
        const a = toContent(container, r.left, r.top);
        const hit = a.x < right && a.x + r.width > left && a.y < bottom && a.y + r.height > top;
        if (hit && row.dataset.path) selected.add(row.dataset.path);
      });
      paint();
    };

    // ポインタが上下端にある間、止まっていてもスクロールし続ける
    const autoScroll = (): void => {
      scrollTimer = null;
      const rect = container.getBoundingClientRect();
      let dy = 0;
      if (last.y < rect.top + EDGE) dy = -SCROLL_STEP;
      else if (last.y > rect.bottom - EDGE) dy = SCROLL_STEP;
      if (dy === 0) return;
      const before = container.scrollTop;
      container.scrollTop += dy;
      if (container.scrollTop !== before) update();
      scrollTimer = requestAnimationFrame(autoScroll);
    };

    const onMove = (ev: MouseEvent): void => {
      last = { x: ev.clientX, y: ev.clientY };
      if (!box) {
        const dist = Math.hypot(last.x - startClient.x, last.y - startClient.y);
        if (dist < DRAG_THRESHOLD) return;
        box = document.createElement("div");
        box.className = "tree-marquee";
        container.appendChild(box);
      }
      update();
      if (scrollTimer === null) scrollTimer = requestAnimationFrame(autoScroll);
    };

    const onUp = (): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (scrollTimer !== null) cancelAnimationFrame(scrollTimer);
      if (box) {
        box.remove();
        suppressClick = true;
        // mouseup が container の外だと click は container に届かない。
        // フラグが残ると次の本物のクリックを食うので、click の配送後に必ず下ろす
        setTimeout(() => (suppressClick = false), 0);
      } else if (!target.closest(".tree-row") && !additive) {
        // 行の外をクリックしただけなら全解除
        clearSelection();
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}
