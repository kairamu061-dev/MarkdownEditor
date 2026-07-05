import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const MONO_FONT = "'Cascadia Code', Consolas, monospace";

// 色は nord.css のエイリアスのみを参照する（唯一の色定義元）
export const nordTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--bg-primary)",
      color: "var(--text)",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      fontFamily: "inherit",
      lineHeight: "1.6",
    },
    ".cm-content": {
      maxWidth: "800px",
      margin: "0 auto",
      padding: "32px 24px",
      caretColor: "var(--accent)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--accent)",
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
      {
        backgroundColor: "var(--bg-hover)",
      },
  },
  { dark: true },
);

export const nordHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, color: "var(--accent-secondary)", fontWeight: "700", fontSize: "1.6em" },
  { tag: t.heading2, color: "var(--accent-secondary)", fontWeight: "700", fontSize: "1.4em" },
  { tag: t.heading3, color: "var(--accent-secondary)", fontWeight: "700", fontSize: "1.25em" },
  { tag: t.heading4, color: "var(--accent-secondary)", fontWeight: "700", fontSize: "1.15em" },
  { tag: t.heading5, color: "var(--accent-secondary)", fontWeight: "700", fontSize: "1.05em" },
  { tag: t.heading6, color: "var(--accent-secondary)", fontWeight: "700" },
  { tag: t.strong, color: "var(--text-strong)", fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--border)" },
  {
    tag: t.monospace,
    fontFamily: MONO_FONT,
    fontSize: "0.9em",
    backgroundColor: "var(--bg-hover)",
    borderRadius: "3px",
  },
  { tag: t.link, color: "var(--accent)", textDecoration: "underline" },
  { tag: t.url, color: "var(--accent)" },
  { tag: t.quote, fontStyle: "italic" },
  { tag: t.contentSeparator, color: "var(--border)" },
  { tag: t.processingInstruction, color: "var(--border)" },
  { tag: t.labelName, color: "var(--accent-secondary)" },
]);
