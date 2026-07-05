import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { type EditorState, type Extension, type Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

const WIKILINK_RE = /\[\[([^[\]]+)\]\]/g;
const CODE_NODES = new Set(["InlineCode", "FencedCode", "CodeBlock", "CodeText"]);

const hide = Decoration.replace({});

function inCode(state: EditorState, pos: number): boolean {
  for (
    let node: { name: string; parent: unknown } | null = syntaxTree(state).resolveInner(pos, 1);
    node;
    node = node.parent as { name: string; parent: unknown } | null
  ) {
    if (CODE_NODES.has(node.name)) return true;
  }
  return false;
}

function touchesSelection(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.to >= from && r.from <= to);
}

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const { state } = view;

  for (const { from, to } of view.visibleRanges) {
    const text = state.doc.sliceString(from, to);
    for (const match of text.matchAll(WIKILINK_RE)) {
      const start = from + match.index;
      const end = start + match[0].length;
      const name = match[1];
      if (inCode(state, start + 2)) continue;

      if (touchesSelection(state, start, end)) {
        // ソース表示: 括弧は見せ、内側だけリンク色
        decorations.push(
          Decoration.mark({ class: "cm-wikilink" }).range(start + 2, end - 2),
        );
      } else {
        // 整形表示: 括弧を隠し、クリック可能なリンクにする
        decorations.push(hide.range(start, start + 2));
        decorations.push(
          Decoration.mark({
            class: "cm-wikilink cm-wikilink-rendered",
            attributes: { "data-note": name },
          }).range(start + 2, end - 2),
        );
        decorations.push(hide.range(end - 2, end));
      }
    }
  }
  return Decoration.set(decorations, true);
}

export function wikilink(onOpen: (name: string) => void): Extension {
  const plugin = ViewPlugin.fromClass(
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
    { decorations: (p) => p.decorations },
  );

  const clickHandler = EditorView.domEventHandlers({
    mousedown(event) {
      const target = (event.target as HTMLElement).closest?.(".cm-wikilink-rendered");
      const name = target?.getAttribute("data-note");
      if (!name) return false;
      event.preventDefault();
      onOpen(name);
      return true;
    },
  });

  const theme = EditorView.baseTheme({
    ".cm-wikilink": {
      color: "var(--accent)",
      textDecoration: "underline",
    },
    ".cm-wikilink-rendered": {
      cursor: "pointer",
    },
  });

  return [plugin, clickHandler, theme];
}
