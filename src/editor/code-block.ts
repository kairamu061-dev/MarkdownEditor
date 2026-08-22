import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { type Extension, type Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

const codeLine = Decoration.line({ class: "cm-codeblock-line" });

// フェンスコードブロックの行に等幅フォントと背景を適用する。
// 言語トークンは markdown の monospace タグを持たないため、行単位で当てる必要がある
function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = view.state.doc;
  let lastLine = -1;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== "FencedCode" && node.name !== "CodeBlock") return;
        const first = doc.lineAt(node.from).number;
        const last = doc.lineAt(node.to).number;
        for (let n = Math.max(first, lastLine + 1); n <= last; n++) {
          decorations.push(codeLine.range(doc.line(n).from));
        }
        lastLine = Math.max(lastLine, last);
      },
    });
  }
  return Decoration.set(decorations, true);
}

const codeBlockPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const codeBlockTheme = EditorView.baseTheme({
  ".cm-codeblock-line": {
    fontFamily: "'Cascadia Code', Consolas, monospace",
    fontSize: "0.9em",
    // 下地は行そのものではなく擬似要素に敷く（BUG-033）。
    // drawSelection() の選択レイヤは .cm-scroller の中で z-index: -2 に置かれる。
    // 行に background-color を掛けると、行は通常フローの要素として
    // その手前に描かれ、選択のハイライトを覆い隠してしまう
    position: "relative",
  },
  ".cm-codeblock-line::before": {
    content: '""',
    position: "absolute",
    inset: "0",
    // 選択レイヤ（-2）より後ろ。.cm-content は position: static で
    // 重ね合わせコンテキストを作らないため、この -3 は .cm-scroller の
    // コンテキストで評価され、選択レイヤより下に入る
    zIndex: "-3",
    backgroundColor: "var(--code-bg)",
    pointerEvents: "none",
  },
});

export function codeBlockStyle(): Extension {
  return [codeBlockPlugin, codeBlockTheme];
}
