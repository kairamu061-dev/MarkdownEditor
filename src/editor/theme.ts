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
      // フォントは settings/ui が設定する CSS 変数を参照（未設定時はシステムフォント/14px）
      fontFamily: "var(--editor-font-family, inherit)",
      fontSize: "var(--editor-font-size, 14px)",
      lineHeight: "1.6",
    },
    ".cm-content": {
      maxWidth: "1100px",
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
  // t.heading (base) matches TableHeader cells; level-specific rules take precedence for ATX headings
  { tag: t.heading, color: "var(--accent-secondary)", fontWeight: "700" },
  { tag: t.heading1, color: "var(--warning)", fontWeight: "700", fontSize: "1.6em" },
  { tag: t.heading2, color: "var(--accent)", fontWeight: "700", fontSize: "1.4em" },
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
  { tag: t.processingInstruction, color: "var(--syntax-mark)" },
  { tag: t.labelName, color: "var(--accent-secondary)" },

  // コードブロック内トークン（editor/code-highlight spec の配色表に対応）
  { tag: t.keyword, color: "var(--accent-secondary)" },
  { tag: [t.string, t.special(t.string)], color: "var(--success)" },
  { tag: t.comment, color: "var(--comment)", fontStyle: "italic" },
  { tag: [t.number, t.bool, t.atom], color: "var(--nord15)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--accent)" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--nord7)" },
  { tag: t.propertyName, color: "var(--text)" },
  { tag: [t.operator, t.punctuation], color: "var(--accent-secondary)" },
  { tag: [t.variableName, t.name], color: "var(--text)" },
]);
