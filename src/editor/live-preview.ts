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
