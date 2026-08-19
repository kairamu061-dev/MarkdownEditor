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
  type EditorState,
  type Extension,
  type Line,
  Prec,
  type Range,
} from "@codemirror/state";
import { insertNewline } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { type SyntaxNode } from "@lezer/common";

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

/** 段数 d（0 始まり）・行頭空白の有無・弾丸行かどうかから行スタイルを組む */
function listLineStyle(d: number, hasIndent: boolean, isItemStart: boolean): string {
  const negative: string[] = [];
  if (hasIndent && d > 0) negative.push(`${d} * ${INDENT_STEP}`);
  if (isItemStart) negative.push(BULLET_WIDTH);
  const textIndent = negative.length ? `calc(-1 * (${negative.join(" + ")}))` : "0";
  return (
    `padding-left:calc(${INDENT_BASE} + ${d} * ${INDENT_STEP} + ${BULLET_WIDTH});` +
    `text-indent:${textIndent};` +
    guideStyle(d)
  );
}

// 行スタイルは (段数, 行頭空白の有無, 弾丸行か) の組でしか変わらないのでキャッシュする
const listLineCache = new Map<string, Decoration>();
function listLine(d: number, hasIndent: boolean, isItemStart: boolean): Decoration {
  const key = `${d}:${hasIndent ? 1 : 0}:${isItemStart ? 1 : 0}`;
  let deco = listLineCache.get(key);
  if (!deco) {
    deco = Decoration.line({ attributes: { style: listLineStyle(d, hasIndent, isItemStart) } });
    listLineCache.set(key, deco);
  }
  return deco;
}

const indentBoxCache = new Map<number, Decoration>();
function indentBox(d: number): Decoration {
  let deco = indentBoxCache.get(d);
  if (!deco) {
    deco = Decoration.mark({
      attributes: { style: `display:inline-block;width:calc(${d} * ${INDENT_STEP})` },
    });
    indentBoxCache.set(d, deco);
  }
  return deco;
}

interface ListLineInfo {
  /** 箇条書きの段数（0 始まり）。箇条書き行でなければ null */
  depth: number;
  /** その行から新しい ListItem が始まる（＝行頭にマークがある） */
  isItemStart: boolean;
}

/**
 * 行が箇条書きの何段目かを構文木から求める。箇条書き外なら null。
 *
 * 段数は BulletList と OrderedList の両方を数えるが、装飾するのは祖先に
 * BulletList がある行だけ。番号付きリストの中に `- ` を入れた場合に段が
 * 1 つ潰れるのを防ぎつつ、番号付きリスト自体の見た目は変えない。
 * 引用の中の箇条書き（`> - x`）は行頭が QuoteMark なので対象外になる。
 */
function listLineInfo(state: EditorState, line: Line, indentLen: number): ListLineInfo | null {
  if (indentLen >= line.length) return null; // 空行・空白のみの行
  let depth = 0;
  let inBulletList = false;
  let item: SyntaxNode | null = null;
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(line.from + indentLen, 1);
    node;
    node = node.parent
  ) {
    if (node.name === "BulletList") {
      depth++;
      inBulletList = true;
    } else if (node.name === "OrderedList") depth++;
    else if (node.name === "ListItem" && !item) item = node;
  }
  if (!inBulletList) return null;
  return { depth: depth - 1, isItemStart: !!item && item.from >= line.from };
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
      decorations.push(listLine(info.depth, indentLen > 0, info.isItemStart).range(line.from));
      if (indentLen > 0 && info.depth > 0) {
        decorations.push(indentBox(info.depth).range(line.from, line.from + indentLen));
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
    "--md-list-guide": "var(--border)",
    "--md-list-guide-width": "1px",
    "--md-list-guide-offset": "0.5ch", // 弾丸の中心あたりへ線を寄せる
  },
  ".cm-list-bullet": {
    color: "var(--accent)",
    // 幅を固定して「弾丸 + 空白」の見かけの幅をフォントから切り離す
    display: "inline-block",
    width: "var(--md-list-bullet-width)",
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
  // markdown() は Enter を Prec.high で束ねるため、Prec.highest で先に判定する。
  // quoteAwareEnter が false を返した場合は既定の insertNewlineContinueMarkup に渡る
  const enterOverride = Prec.highest(keymap.of([{ key: "Enter", run: quoteAwareEnter }]));
  return [livePreviewPlugin, livePreviewTheme, clickHandler, enterOverride];
}
