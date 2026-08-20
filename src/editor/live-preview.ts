import {
  type Command,
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import {
  type ChangeSpec,
  type EditorState,
  type Extension,
  type Line,
  Prec,
  type Range,
} from "@codemirror/state";
import { indentLess, indentMore, insertNewline } from "@codemirror/commands";
import { insertNewlineContinueMarkupCommand } from "@codemirror/lang-markdown";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { type SyntaxNode, type Tree } from "@lezer/common";

// 弾丸は `-` と**直後の空白まで**を置き換え、幅を --md-list-bullet-width に固定する。
// 空白を残すとその幅がフォント依存になり、下の幾何計算（本文開始位置 = 弾丸幅）が
// 「だいたい合う」程度に落ちる。等幅フォントでは "• " が 2ch あり 1.4ch とずれる
class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.textContent = "•";
    return span;
  }
  override eq(): boolean {
    return true;
  }
}

const bullet = Decoration.replace({ widget: new BulletWidget() });
const hide = Decoration.replace({});

// --- 箇条書きのインデント ---------------------------------------------------
// 見た目のインデントは Markdown 原文の空白幅に依存させない。原文の行頭空白へ
// 「幅を固定した inline-block」の mark デコレーションを掛け、その幅を段数から決める。
// replace ではなく mark なので空白は本物のテキストのまま残り、カーソル移動・
// Backspace・Shift+Tab は素の挙動を保つ。
//
// 段 d（0 始まり）の行に対して
//   行頭空白の幅 W = d * step   （d = 0 の行には行頭空白が無いので W = 0）
//   padding-left  P = base + d * step + bulletWidth
//   text-indent  -T,  T = W + (行頭が箇条書きマークなら bulletWidth)
// とすると
//   1 行目の左端      = P - T           = base + d * step   … 弾丸の位置
//   1 行目の本文開始  = P - T + W + 弾丸 = base + d * step + bulletWidth
//   折り返し行の左端  = P                = base + d * step + bulletWidth
// となり、本文と折り返しが段数によらず一致する（ハンギングインデント）。
//
// T をウィジェットの有無ではなく構文木の段数だけで決めているのが要点。カーソルが
// 乗って `-` がソース表示に戻っても行の左端が動かない（旧 `:has()` 版は動いていた）。
const INDENT_BASE = "var(--md-list-indent-base)";
const INDENT_STEP = "var(--md-list-indent-step)";
const BULLET_WIDTH = "var(--md-list-bullet-width)";

/** 段数 d（0 始まり）ぶんの縦ガイド線を、行の背景として重ねる */
function guideStyle(d: number): string {
  if (d < 1) return "";
  const layers: string[] = [];
  const positions: string[] = [];
  const sizes: string[] = [];
  for (let i = 0; i < d; i++) {
    layers.push("linear-gradient(var(--md-list-guide) 0 0)");
    positions.push(
      `calc(${INDENT_BASE} + ${i} * ${INDENT_STEP} + var(--md-list-guide-offset)) 0`,
    );
    sizes.push("var(--md-list-guide-width) 100%");
  }
  return (
    `background-image:${layers.join(",")};` +
    `background-position:${positions.join(",")};` +
    `background-size:${sizes.join(",")};` +
    // 行は縦に積まれるので 100% 高の帯が連なって 1 本の線に見える。
    // 原点を border-box にしないと padding-left ぶん右へずれる
    `background-repeat:no-repeat;background-origin:border-box;`
  );
}

/** 段数 d（0 始まり）・行頭空白の有無・マーク行かどうか・マーカー幅から行スタイルを組む */
function listLineStyle(
  d: number,
  hasIndent: boolean,
  isItemStart: boolean,
  markerWidth: string,
): string {
  const negative: string[] = [];
  if (hasIndent && d > 0) negative.push(`${d} * ${INDENT_STEP}`);
  if (isItemStart) negative.push(markerWidth);
  const textIndent = negative.length ? `calc(-1 * (${negative.join(" + ")}))` : "0";
  return (
    `padding-left:calc(${INDENT_BASE} + ${d} * ${INDENT_STEP} + ${markerWidth});` +
    `text-indent:${textIndent};` +
    guideStyle(d)
  );
}

// 行スタイルは (段数, 行頭空白の有無, マーク行か, マーカー幅) の組でしか変わらない
const listLineCache = new Map<string, Decoration>();
function listLine(
  d: number,
  hasIndent: boolean,
  isItemStart: boolean,
  markerWidth: string,
): Decoration {
  const key = `${d}:${hasIndent ? 1 : 0}:${isItemStart ? 1 : 0}:${markerWidth}`;
  let deco = listLineCache.get(key);
  if (!deco) {
    deco = Decoration.line({
      attributes: { style: listLineStyle(d, hasIndent, isItemStart, markerWidth) },
    });
    listLineCache.set(key, deco);
  }
  return deco;
}

// 番号付きマークの幅を固定する箱。text-indent:0 は弾丸・行頭空白と同じ理由
const markerBoxCache = new Map<string, Decoration>();
function markerBox(width: string): Decoration {
  let deco = markerBoxCache.get(width);
  if (!deco) {
    deco = Decoration.mark({
      attributes: { style: `display:inline-block;width:${width};text-indent:0` },
    });
    markerBoxCache.set(width, deco);
  }
  return deco;
}

const indentBoxCache = new Map<number, Decoration>();
function indentBox(d: number): Decoration {
  let deco = indentBoxCache.get(d);
  if (!deco) {
    deco = Decoration.mark({
      // text-indent:0 は弾丸と同じ理由（行の負の text-indent を継承させない）。
      // 中身が空白なので見た目には出ないが、同じ罠なので明示しておく
      attributes: {
        style: `display:inline-block;width:calc(${d} * ${INDENT_STEP});text-indent:0`,
      },
    });
    indentBoxCache.set(d, deco);
  }
  return deco;
}

interface ListLineInfo {
  /** リストの段数（0 始まり）。リスト行でなければ null */
  depth: number;
  /** その行から新しい ListItem が始まる（＝行頭にマークがある） */
  isItemStart: boolean;
  /** マーカーの見かけの幅（CSS 長さ）。折り返し位置の計算にそのまま使う */
  markerWidth: string;
  /** 番号付きマークの範囲。幅を固定する mark を張る。弾丸・継続行では null */
  orderedMark: { from: number; to: number } | null;
}

/**
 * マーカーの見かけの幅を決める。
 *
 * 弾丸はウィジェットの幅を CSS で固定しているので定数。番号付きは `1.` `10.` と
 * 桁数で変わるため、文字数 × 1ch の箱に入れる。数字の字幅は多くのフォントで
 * `ch`（「0」の幅）と一致し、`.` と空白はそれより狭いので、箱は必ず中身より広くなる
 * （はみ出して本文に重なることが無い）。
 */
function orderedMarkerWidth(len: number): string {
  return `calc(${len} * var(--md-list-marker-unit))`;
}

/** ListItem のマーク範囲（直後の空白 1 つを含む）を返す */
function markRange(
  state: EditorState,
  item: SyntaxNode,
): { from: number; to: number } | null {
  const mark = item.firstChild;
  if (!mark || mark.name !== "ListMark") return null;
  const after = state.doc.sliceString(mark.to, mark.to + 1);
  return { from: mark.from, to: after === " " ? mark.to + 1 : mark.to };
}

/**
 * 行がリストの何段目かを構文木から求める。リスト外なら null。
 *
 * 段数は BulletList と OrderedList の両方を数える（混在しても段が潰れない）。
 * 引用の中のリスト（`> - x`）は行頭が QuoteMark なので対象外になる。
 */
function listLineInfo(state: EditorState, line: Line, indentLen: number): ListLineInfo | null {
  if (indentLen >= line.length) return null; // 空行・空白のみの行
  let depth = 0;
  let item: SyntaxNode | null = null;
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(line.from + indentLen, 1);
    node;
    node = node.parent
  ) {
    if (node.name === "BulletList" || node.name === "OrderedList") depth++;
    else if (node.name === "ListItem" && !item) item = node;
  }
  if (depth === 0 || !item) return null;

  // マーカーの幅は「その行が属する項目」から決める。継続行（マークを持たない行）も
  // 親項目の幅を使うことで、本文の開始位置がその項目の本文と揃う
  const ordered = item.parent?.name === "OrderedList";
  const range = markRange(state, item);
  const isItemStart = item.from >= line.from;
  let markerWidth = BULLET_WIDTH;
  let orderedMark: { from: number; to: number } | null = null;
  if (ordered) {
    markerWidth = orderedMarkerWidth(range ? range.to - range.from : 3);
    // 番号は replace せず生テキストのまま残すので、幅だけ mark で固定する
    if (isItemStart && range) orderedMark = range;
  }
  return { depth: depth - 1, isItemStart, markerWidth, orderedMark };
}

// 引用行に付ける行デコレーション（左バー・背景・本文色は CSS 側で付与）
const blockquoteLine = Decoration.line({ class: "cm-blockquote" });

// 記法マークノード → ソース表示の判定に使う親ノード（仕様: 判定単位は構文ノード全体）
const MARK_PARENTS: Record<string, string[]> = {
  EmphasisMark: ["Emphasis", "StrongEmphasis"],
  CodeMark: ["InlineCode"],
  StrikethroughMark: ["Strikethrough"],
};

function touchesSelection(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.to >= from && r.from <= to);
}

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const { state } = view;
  const doc = state.doc;
  // 引用行の行デコレーションを重複させない（ネスト引用は複数ノードが同じ行を跨ぐため）
  const quoteLineStarts = new Set<number>();
  // 可視範囲が 1 行を分割して並ぶ場合に、同じ行を 2 度装飾しない
  const listLineStarts = new Set<number>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        // 引用マーク `>`: その行に cm-blockquote を付与し、`>`（＋直後の空白）を隠す。
        // 判定基準を Blockquote ノードではなく QuoteMark にすることで、行頭が実際に `>` の行だけが
        // 引用扱いになる。CommonMark の遅延継続で `>` の無い行が Blockquote に含まれても装飾しない
        if (node.name === "QuoteMark") {
          const line = doc.lineAt(node.from);
          if (!quoteLineStarts.has(line.from)) {
            quoteLineStarts.add(line.from);
            decorations.push(blockquoteLine.range(line.from));
          }
          // カーソルがその行にある間は `>` をソース表示（編集・削除できるように）
          if (!touchesSelection(state, line.from, line.to)) {
            const markEnd =
              doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
            decorations.push(hide.range(node.from, markEnd));
          }
          return;
        }

        // 見出し: マーク + 直後の空白 1 つを隠す（判定は見出し行全体）
        if (node.name === "HeaderMark") {
          const heading = node.node.parent;
          if (
            heading &&
            /^ATXHeading[1-6]$/.test(heading.name) &&
            !touchesSelection(state, heading.from, heading.to)
          ) {
            const markEnd =
              doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
            decorations.push(hide.range(node.from, markEnd));
          }
          return;
        }

        // 強調・打ち消し・インラインコードのマーク
        const parents = MARK_PARENTS[node.name];
        if (parents) {
          const parent = node.node.parent;
          if (
            parent &&
            parents.includes(parent.name) &&
            !touchesSelection(state, parent.from, parent.to)
          ) {
            decorations.push(hide.range(node.from, node.to));
          }
          return;
        }

        // インラインリンク: [テキスト](URL)。Lezer では LinkText ノードが無く、
        // テキストは最初の `[` と `]` の LinkMark に挟まれた範囲。ここにクリック属性を付け、
        // 記法（`[` と `](URL)`）を隠す。marks は文書順に [ '[', ']', '(', ')' ]
        if (node.name === "Link") {
          if (touchesSelection(state, node.from, node.to)) return;
          const link = node.node;
          const marks: { from: number; to: number }[] = [];
          let url: { from: number; to: number } | null = null;
          for (let child = link.firstChild; child; child = child.nextSibling) {
            if (child.name === "LinkMark") marks.push({ from: child.from, to: child.to });
            else if (child.name === "URL") url = { from: child.from, to: child.to };
          }
          if (url && marks.length >= 4) {
            const textFrom = marks[0].to; // `[` の直後
            const textTo = marks[1].from; // `]` の直前
            const urlText = doc.sliceString(url.from, url.to);
            decorations.push(hide.range(marks[0].from, marks[0].to)); // `[` を隠す
            if (textTo > textFrom) {
              decorations.push(
                Decoration.mark({
                  class: "cm-md-link",
                  attributes: { "data-href": urlText },
                }).range(textFrom, textTo),
              );
            }
            decorations.push(hide.range(marks[1].from, marks[3].to)); // `](URL)` を隠す
          }
          return;
        }

        // 箇条書きマーク → • ウィジェット
        if (node.name === "ListMark") {
          const item = node.node.parent;
          // 直後の空白 1 つも巻き込む（見出し・引用マークと同じ扱い）。
          // 弾丸の見かけの幅を CSS 側で決め切るため。
          // カーソル判定は従来どおりマーク自体（1 文字）で行う。置換範囲の内側にあたる
          // 位置は node.to だけで、そこは既にこの判定に含まれる。判定まで広げると
          // 本文先頭（Enter 直後のカーソル位置）で毎回 `- ` がソース表示に戻ってしまう
          const markEnd =
            doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
          if (
            item?.name === "ListItem" &&
            item.parent?.name === "BulletList" &&
            !touchesSelection(state, node.from, node.to) &&
            /^[-*+]$/.test(doc.sliceString(node.from, node.to))
          ) {
            decorations.push(bullet.range(node.from, markEnd));
          }
        }
      },
    });

    // 箇条書き行のインデント。ノード単位の走査では 1 行に複数ノードが跨って
    // 行デコレーションが重複するため、行単位の 2 パス目として処理する
    for (let pos = from; pos <= to; ) {
      const line = doc.lineAt(pos);
      pos = line.to + 1;
      if (listLineStarts.has(line.from)) continue;
      listLineStarts.add(line.from);
      const indentLen = /^[ \t]*/.exec(line.text)![0].length;
      const info = listLineInfo(state, line, indentLen);
      if (!info) continue;
      decorations.push(
        listLine(info.depth, indentLen > 0, info.isItemStart, info.markerWidth).range(line.from),
      );
      if (indentLen > 0 && info.depth > 0) {
        decorations.push(indentBox(info.depth).range(line.from, line.from + indentLen));
      }
      if (info.orderedMark) {
        decorations.push(
          markerBox(info.markerWidth).range(info.orderedMark.from, info.orderedMark.to),
        );
      }
    }
  }

  return Decoration.set(decorations, true);
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const livePreviewTheme = EditorView.baseTheme({
  // 箇条書きの見た目の寸法はここだけで決まる。深さを変えたいときは step を触る
  "&": {
    "--md-list-indent-base": "2ch", // 0 段目にも入れる行頭の余白
    "--md-list-indent-step": "4ch", // 1 段あたりのインデント幅
    "--md-list-bullet-width": "1.4ch", // "• " ぶんの見かけの幅
    "--md-list-marker-unit": "1ch", // 番号付きマーク "1. " の 1 文字あたりの幅
    "--md-list-guide": "var(--border)",
    "--md-list-guide-width": "1px",
    "--md-list-guide-offset": "0.5ch", // 弾丸の中心あたりへ線を寄せる
  },
  ".cm-list-bullet": {
    color: "var(--accent)",
    // 幅を固定して「弾丸 + 空白」の見かけの幅をフォントから切り離す
    display: "inline-block",
    width: "var(--md-list-bullet-width)",
    // inline-block はブロックコンテナなので、行に掛けた負の text-indent を
    // **継承して自分の中身にも適用する**。打ち消さないと「•」だけが箱の左外
    // （行頭）へ飛び、段を深くしても弾丸が動かなくなる
    textIndent: "0",
  },
  ".cm-md-link": {
    cursor: "pointer",
  },
  // 引用行: 左バー + 淡い背景 + 落ち着いた本文色 + 斜体。連続する引用行で
  // バー・背景が縦に繋がって 1 本の引用帯に見える。行頭 `>` は隠す（buildDecorations）。
  // 斜体もここで付けることで QuoteMark のある行だけに限定する（BUG-011）
  ".cm-blockquote": {
    borderLeft: "3px solid var(--quote-bar)",
    paddingLeft: "16px",
    backgroundColor: "var(--quote-bg)",
    color: "var(--quote-text)",
    fontStyle: "italic",
  },
  // 箇条書き行のインデント・ハンギングインデント・縦ガイド線は
  // buildDecorations が段数ごとの行デコレーション（inline style）で与える。
  // 以前はここに `.cm-line:has(.cm-list-bullet)` を置いていたが、カーソルが乗って
  // 弾丸がソース表示に戻ると :has が外れて行が横に飛ぶため構文木ベースへ移した
});

// Enter の引用継続を「行頭が実際に `>` の行」に限定する（BUG-011）。
// CommonMark の遅延継続で `>` の無い行もパーサ上は Blockquote 内になり、
// lang-markdown の insertNewlineContinueMarkup が `> ` を挿入してしまうのを防ぐ。
const quoteAwareEnter: Command = (view) => {
  const { state } = view;
  if (state.selection.ranges.length !== 1) return false;
  const range = state.selection.main;
  if (!range.empty) return false;
  const line = state.doc.lineAt(range.head);
  // 行頭が `>`（先頭空白 0〜3 まで許容）なら通常どおり引用継続させる
  if (/^ {0,3}>/.test(line.text)) return false;
  // 見た目は非引用だがパーサ上は Blockquote 内（遅延継続）の行なら、
  // 引用継続させずに plain な改行にする。リスト等は Blockquote 外なので影響しない
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(range.head, -1);
    node;
    node = node.parent
  ) {
    if (node.name === "Blockquote") return insertNewline(view);
  }
  return false;
};

// 空の箇条書き項目で Enter を押したときに、マークを消さず「上に空行を挿入して
// リストを loose 化する」のが lang-markdown の既定（BUG-025）。
// `- aaaa` → Enter → Enter が `- aaaa` / 空行 / `- ` になり、Obsidian のように
// 項目が消えない。この分岐は 2 項目のタイト（項目間に空行が無い）なリストでだけ
// 起き、3 項目目以降や既に loose なリストでは既定でもマークが消える。
// nonTightLists: false でその分岐を止め、常にマークを消す側へ寄せる
const markupEnter = insertNewlineContinueMarkupCommand({ nonTightLists: false });

// Enter は quoteAwareEnter → markupEnter の順に試す。どちらも false を返した場合
// （Markdown 文脈でない等）は既定のキーマップへ渡る
const listAwareEnter: Command = (view) => quoteAwareEnter(view) || markupEnter(view);

// --- 番号付きリストの採番 ---------------------------------------------------
// Tab / Shift+Tab で段を変えても番号が振り直されない、という報告への対応。
// **文書テキストを書き換える**処理なので、構文木が対象範囲を完全に覆えている
// ことを確認できたときだけ実行し、少しでも怪しければ何もしない。

/** upto までパースが届いた木を返す。届かなければ null */
function treeCovering(state: EditorState, upto: number): Tree | null {
  const tree = syntaxTree(state);
  if (tree.length >= upto) return tree;
  const full = ensureSyntaxTree(state, upto, 200);
  return full && full.length >= upto ? full : null;
}

/** pos を含む最も外側のリストノード */
function outermostList(tree: Tree, pos: number): SyntaxNode | null {
  let found: SyntaxNode | null = null;
  for (let node: SyntaxNode | null = tree.resolveInner(pos, -1); node; node = node.parent) {
    if (node.name === "OrderedList" || node.name === "BulletList") found = node;
  }
  return found;
}

/**
 * OrderedList 1 つぶんの採番を計算して changes に積む。成否を返す。
 *
 * 開始番号は、**入れ子のリストなら常に 1**、最上位のリストなら先頭項目の番号を
 * 引き継ぐ（`3.` から始まるリストは 3 のまま）。入れ子を 1 固定にしたのは、
 * Tab で新しく生まれた入れ子や、Shift+Tab で分割された後半の断片が、
 * 元の番号を引きずってしまうため（E-24 の実測でこの規則に決めた）。
 *
 * 想定外の形（ListMark が無い・番号として読めない）に出会ったら**そのリストは
 * 触らない**。半端に書き換えるより何もしない方が安全。
 */
function collectRenumber(
  state: EditorState,
  list: SyntaxNode,
  changes: ChangeSpec[],
): void {
  const pending: ChangeSpec[] = [];
  const nested = list.parent?.name === "ListItem";
  let start: number | null = null;
  let index = 0;
  for (let item = list.firstChild; item; item = item.nextSibling) {
    if (item.name !== "ListItem") continue;
    const mark = item.firstChild;
    if (!mark || mark.name !== "ListMark") return;
    const text = state.doc.sliceString(mark.from, mark.to);
    const parsed = /^(\d+)([.)])$/.exec(text);
    if (!parsed) return;
    if (start === null) start = nested ? 1 : parseInt(parsed[1], 10);
    const want = `${start + index}${parsed[2]}`;
    if (want !== text) pending.push({ from: mark.from, to: mark.to, insert: want });
    index++;
  }
  changes.push(...pending);
}

/**
 * pos を含むリスト全体の採番をやり直す変更を返す。
 * 構文木が対象範囲を覆えないときは null（＝何もしない）。
 */
function renumberChanges(state: EditorState, pos: number): ChangeSpec[] | null {
  let tree = treeCovering(state, pos);
  if (!tree) return null;
  let list = outermostList(tree, pos);
  if (!list) return [];
  if (tree.length < list.to) {
    const covered = treeCovering(state, list.to);
    if (!covered) return null;
    tree = covered;
    list = outermostList(tree, pos);
    if (!list) return [];
  }
  const changes: ChangeSpec[] = [];
  const { from, to } = list;
  tree.iterate({
    from,
    to,
    enter: (node) => {
      if (node.name === "OrderedList") collectRenumber(state, node.node, changes);
    },
  });
  return changes;
}

// --- リスト項目の Tab / Shift+Tab -------------------------------------------
// 既定の indentMore は indentUnit（2 スペース）を足すだけ。箇条書きは `- ` が
// 2 文字なのでたまたま入れ子になるが、**番号付きは `1. ` が 3 文字なので 2 では
// 入れ子にならない**。構造が変わらないので番号も変わらず、「インデントしても
// 番号が変わらない」ように見えていた。
// 段を上げ下げする量は、隣接する項目の桁から決める。

/** その行から始まる ListItem。無ければ null */
function itemStartingOn(state: EditorState, line: Line): SyntaxNode | null {
  const indentLen = /^[ \t]*/.exec(line.text)![0].length;
  if (indentLen >= line.length) return null;
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(line.from + indentLen, 1);
    node;
    node = node.parent
  ) {
    if (node.name === "ListItem") return node.from >= line.from ? node : null;
  }
  return null;
}

function previousSiblingItem(item: SyntaxNode): SyntaxNode | null {
  for (let n = item.prevSibling; n; n = n.prevSibling) {
    if (n.name === "ListItem") return n;
  }
  return null;
}

/** 項目の本文が始まる桁（マーク + 直後の空白のぶん） */
function contentColumn(state: EditorState, item: SyntaxNode): number | null {
  const range = markRange(state, item);
  if (!range) return null;
  return range.to - state.doc.lineAt(item.from).from;
}

/**
 * 行頭の空白を指定の桁数に置き換え、**同じトランザクションで**採番し直す。
 *
 * 採番には字下げ後の構文木が要るので、まず `state.update` で結果の状態だけを作り、
 * そこで番号を計算してから 2 つの変更を compose して 1 回だけ dispatch する。
 * 分けて dispatch すると Ctrl+Z が 2 段になり、1 回目で「字下げは済んでいるが
 * 番号が古い」という中途半端な状態が露出してしまう（実測で確認）。
 */
function setLineIndent(view: EditorView, line: Line, column: number): void {
  const { state } = view;
  const indentLen = /^[ \t]*/.exec(line.text)![0].length;
  const insert = " ".repeat(column);
  if (insert === line.text.slice(0, indentLen)) return;
  const indented = state.update({
    changes: { from: line.from, to: line.from + indentLen, insert },
  });
  const next = indented.state;
  const renumber = renumberChanges(next, next.selection.main.head);
  const changes =
    renumber && renumber.length
      ? indented.changes.compose(next.changes(renumber))
      : indented.changes;
  view.dispatch({ changes, userEvent: "input.indent", scrollIntoView: true });
}

/** カーソル 1 つ・選択なし・行頭がリストマーク、のときだけ処理する */
function soleListItem(view: EditorView): { line: Line; item: SyntaxNode } | null {
  const { state } = view;
  if (state.selection.ranges.length !== 1 || !state.selection.main.empty) return null;
  const line = state.doc.lineAt(state.selection.main.head);
  const item = itemStartingOn(state, line);
  return item ? { line, item } : null;
}

/** Tab: 直前の兄弟項目の本文の桁まで下げて入れ子にする */
const indentListItem: Command = (view) => {
  const target = soleListItem(view);
  if (!target) return false;
  const prev = previousSiblingItem(target.item);
  // 先頭項目は入れ子にする相手がいない。既定のインデントに落とすと
  // 中途半端な空白が入るだけなので、何もせずキーを消費する
  if (!prev) return true;
  const column = contentColumn(view.state, prev);
  if (column === null) return true;
  setLineIndent(view, target.line, column);
  return true;
};

/** Shift+Tab: 1 つ外側の項目のマークの桁まで戻す */
const outdentListItem: Command = (view) => {
  const target = soleListItem(view);
  if (!target) return false;
  const parentItem = target.item.parent?.parent;
  // 最上位の項目はこれ以上戻せない
  if (!parentItem || parentItem.name !== "ListItem") return true;
  const column = parentItem.from - view.state.doc.lineAt(parentItem.from).from;
  setLineIndent(view, target.line, column);
  return true;
};

export function livePreview(onLinkClick: (href: string) => void): Extension {
  const clickHandler = EditorView.domEventHandlers({
    mousedown(event) {
      const target = event.target as HTMLElement;
      const el = target.closest?.("[data-href]");
      const href = el?.getAttribute("data-href");
      if (!href) return false;
      event.preventDefault();
      onLinkClick(href);
      return true;
    },
  });
  // markdown() は Enter を Prec.high で束ねるため、Prec.highest で先に判定する
  const enterOverride = Prec.highest(
    keymap.of([
      { key: "Enter", run: listAwareEnter },
      // Tab / Shift+Tab は既定のインデント動作のあとに番号を振り直す
      // リスト項目なら段の上げ下げ + 採番、それ以外は既定のインデントへ委譲
      {
        key: "Tab",
        run: (v) => indentListItem(v) || indentMore(v),
        shift: (v) => outdentListItem(v) || indentLess(v),
      },
    ]),
  );
  return [livePreviewPlugin, livePreviewTheme, clickHandler, enterOverride];
}
