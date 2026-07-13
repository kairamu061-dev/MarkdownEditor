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

function touchesSelection(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.to >= from && r.from <= to);
}

class TableWidget extends WidgetType {
  constructor(
    private readonly head: string[][],
    private readonly body: string[][],
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-table-wrap";

    const table = document.createElement("table");
    table.className = "cm-table";

    if (this.head.length > 0) {
      const thead = table.createTHead();
      for (const row of this.head) {
        const tr = thead.insertRow();
        for (const cell of row) {
          const th = document.createElement("th");
          th.textContent = cell;
          tr.appendChild(th);
        }
      }
    }

    if (this.body.length > 0) {
      const tbody = table.createTBody();
      for (const row of this.body) {
        const tr = tbody.insertRow();
        for (const cell of row) {
          const td = tr.insertCell();
          td.textContent = cell;
        }
      }
    }

    wrap.appendChild(table);
    return wrap;
  }

  eq(other: TableWidget): boolean {
    return (
      JSON.stringify(this.head) === JSON.stringify(other.head) &&
      JSON.stringify(this.body) === JSON.stringify(other.body)
    );
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const { state } = view;
  const doc = state.doc;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(nodeRef) {
        if (nodeRef.name !== "Table") return;
        if (touchesSelection(state, nodeRef.from, nodeRef.to)) return false;

        const head: string[][] = [];
        const body: string[][] = [];

        for (let child = nodeRef.node.firstChild; child; child = child.nextSibling) {
          if (child.name === "TableHeader") {
            const cells: string[] = [];
            for (let cell = child.firstChild; cell; cell = cell.nextSibling) {
              if (cell.name === "TableCell") {
                cells.push(doc.sliceString(cell.from, cell.to).trim());
              }
            }
            if (cells.length > 0) head.push(cells);
          } else if (child.name === "TableRow") {
            const cells: string[] = [];
            for (let cell = child.firstChild; cell; cell = cell.nextSibling) {
              if (cell.name === "TableCell") {
                cells.push(doc.sliceString(cell.from, cell.to).trim());
              }
            }
            if (cells.length > 0) body.push(cells);
          }
        }

        if (head.length === 0 && body.length === 0) return false;

        const rangeFrom = doc.lineAt(nodeRef.from).from;
        const rangeTo = doc.lineAt(nodeRef.to).to;

        decorations.push(
          Decoration.replace({
            widget: new TableWidget(head, body),
            block: true,
          }).range(rangeFrom, rangeTo),
        );

        return false;
      },
    });
  }

  return Decoration.set(decorations, true);
}

const tablePreviewPlugin = ViewPlugin.fromClass(
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

const tablePreviewTheme = EditorView.baseTheme({
  ".cm-table-wrap": {
    width: "100%",
    overflowX: "auto",
    margin: "4px 0",
    cursor: "text",
  },
  ".cm-table": {
    borderCollapse: "collapse",
    minWidth: "100%",
  },
  ".cm-table th, .cm-table td": {
    padding: "4px 12px",
    border: "1px solid var(--border)",
    textAlign: "left",
    verticalAlign: "top",
  },
  ".cm-table th": {
    backgroundColor: "var(--bg-sidebar)",
    color: "var(--accent-secondary)",
    fontWeight: "700",
  },
});

export function tablePreview(): Extension {
  return [tablePreviewPlugin, tablePreviewTheme];
}
