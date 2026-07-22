import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { type EditorState, type Extension, type Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

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
// 引用行に付ける行デコレーション（左バー・背景・本文色は CSS 側で付与）。
// テキストを隠さない加算的な装飾なので、IME composition / deleteMarkupBackward に干渉しない（BUG-010 参照）
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
        // 引用ブロック: 各行に cm-blockquote を付与（マークは隠さず加算的に装飾）
        if (node.name === "Blockquote") {
          const lastPos = node.to > node.from ? node.to - 1 : node.to;
          const startLine = doc.lineAt(node.from).number;
          const endLine = doc.lineAt(lastPos).number;
          for (let n = startLine; n <= endLine; n++) {
            const line = doc.line(n);
            if (!quoteLineStarts.has(line.from)) {
              quoteLineStarts.add(line.from);
              decorations.push(blockquoteLine.range(line.from));
            }
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

        // インラインリンク: [テキスト](URL) のマークと URL を隠し、テキストにクリック属性を付与
        if (node.name === "Link") {
          if (touchesSelection(state, node.from, node.to)) return;
          const link = node.node;
          const local: Range<Decoration>[] = [];
          let urlText = "";
          let ltFrom = -1;
          let ltTo = -1;
          for (let child = link.firstChild; child; child = child.nextSibling) {
            if (child.name === "URL") {
              urlText = doc.sliceString(child.from, child.to);
              local.push(hide.range(child.from, child.to));
            } else if (child.name === "LinkMark") {
              local.push(hide.range(child.from, child.to));
            } else if (child.name === "LinkText") {
              ltFrom = child.from;
              ltTo = child.to;
            }
          }
          if (urlText && ltFrom >= 0) {
            local.push(
              Decoration.mark({
                class: "cm-md-link",
                attributes: { "data-href": urlText },
              }).range(ltFrom, ltTo),
            );
          }
          local.sort((a, b) => a.from - b.from);
          decorations.push(...local);
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
  // 引用行: 左バー + 淡い背景 + 落ち着いた本文色。連続する引用行で
  // バー・背景が縦に繋がって 1 本の引用帯に見える。マークは隠さない
  ".cm-blockquote": {
    borderLeft: "3px solid var(--quote-bar)",
    paddingLeft: "16px",
    backgroundColor: "var(--quote-bg)",
    color: "var(--quote-text)",
  },
  // 箇条書き行のハンギングインデント: • の直後でテキストが折り返すよう調整
  // 段数によらず固定オフセット（"• " の幅 ≈ 1.4ch）で揃える
  ".cm-line:has(.cm-list-bullet)": {
    paddingLeft: "1.4ch",
    textIndent: "-1.4ch",
  },
});

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
  return [livePreviewPlugin, livePreviewTheme, clickHandler];
}
