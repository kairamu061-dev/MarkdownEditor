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
  Prec,
  type Range,
} from "@codemirror/state";
import { insertNewline } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { type SyntaxNode } from "@lezer/common";

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
          if (
            item?.name === "ListItem" &&
            item.parent?.name === "BulletList" &&
            !touchesSelection(state, node.from, node.to) &&
            /^[-*+]$/.test(doc.sliceString(node.from, node.to))
          ) {
            decorations.push(bullet.range(node.from, node.to));
          }
        }
      },
    });
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
  ".cm-list-bullet": {
    color: "var(--accent)",
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
  // 箇条書き行のハンギングインデント: • の直後でテキストが折り返すよう調整
  // 段数によらず固定オフセット（"• " の幅 ≈ 1.4ch）で揃える
  ".cm-line:has(.cm-list-bullet)": {
    paddingLeft: "1.4ch",
    textIndent: "-1.4ch",
  },
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
