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
    backgroundColor: "var(--bg-hover)",
  },
});

export function codeBlockStyle(): Extension {
  return [codeBlockPlugin, codeBlockTheme];
}
