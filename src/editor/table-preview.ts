import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { type EditorState, type Extension, type Range, StateField } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

function touchesSelection(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.to >= from && r.from <= to);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// セルテキストをインライン Markdown として HTML に変換する（最小限サブセット）
function renderInline(raw: string): string {
  // 1. コードスパン（`...`）を先に退避させ、内部を他のルールから保護する
  const saved: string[] = [];
  let s = escapeHtml(raw).replace(/`([^`\n]+)`/g, (_, code) => {
    saved.push(code); // already HTML-escaped because we escaped the whole string
    return `\x00${saved.length - 1}\x00`;
  });

  // 2. その他のインライン記法（escapeHtml 済みテキスト上で適用）
  s = s
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '<span class="cm-table-link">$1</span>')
    .replace(/\[\[([^\]]+)\]\]/g, '<span class="cm-table-link">$1</span>');

  // 3. コードスパンを復元
  return s.replace(/\x00(\d+)\x00/g, (_, i) => `<code>${saved[+i]}</code>`);
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
          th.innerHTML = renderInline(cell);
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
          td.innerHTML = renderInline(cell);
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

function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = state.doc;

  syntaxTree(state).iterate({
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

  return Decoration.set(decorations, true);
}

// StateField を使うことで EditorView.decorations.from() 経由でブロックデコレーションを提供できる。
// ViewPlugin の decorations オプションや EditorView.decorations.of(fn) では
// "Block decorations may not be specified via plugins" で禁止されているため使用不可。
const tableDecoField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(deco, tr) {
    if (tr.docChanged || !tr.newSelection.eq(tr.startState.selection)) {
      return buildDecorations(tr.state);
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

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
  ".cm-table code": {
    fontFamily: "'Cascadia Code', Consolas, monospace",
    fontSize: "0.9em",
    backgroundColor: "var(--bg-hover)",
    borderRadius: "3px",
    padding: "0 2px",
  },
  ".cm-table-link": {
    color: "var(--accent)",
    textDecoration: "underline",
  },
});

export function tablePreview(): Extension {
  return [tableDecoField, tablePreviewTheme];
}
