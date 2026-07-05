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

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
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

        // インラインリンク: [テキスト](URL) のマークと URL を隠す
        if (node.name === "Link") {
          if (touchesSelection(state, node.from, node.to)) return;
          const link = node.node;
          for (let child = link.firstChild; child; child = child.nextSibling) {
            if (child.name === "LinkMark" || child.name === "URL") {
              decorations.push(hide.range(child.from, child.to));
            }
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
});

export function livePreview(): Extension {
  return [livePreviewPlugin, livePreviewTheme];
}
