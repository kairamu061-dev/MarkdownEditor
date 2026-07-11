import {
  EditorView,
  keymap,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
} from "@codemirror/view";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
} from "@codemirror/commands";
import { indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { nordTheme, nordHighlightStyle } from "./theme";
import { SCRATCH_DOC } from "./scratch";

export interface MountOptions {
  initialDoc?: string;
  /** live-preview 等の追加拡張。core のコード変更なしで注入する */
  extraExtensions?: Extension[];
  /** 変更のたびに全文を通知する（file-explorer の保存処理が使用） */
  onDocChanged?: (content: string) => void;
}

export interface EditorHandle {
  getContent(): string;
  /** undo 履歴をリセットして内容を差し替える（ファイル切り替え用） */
  setContent(text: string): void;
  focus(): void;
  destroy(): void;
}

export function mountEditor(
  parent: HTMLElement,
  options: MountOptions = {},
): EditorHandle {
  const { initialDoc = SCRATCH_DOC, extraExtensions = [], onDocChanged } = options;

  const extensions: Extension[] = [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    syntaxHighlighting(nordHighlightStyle),
    nordTheme,
    // redo を Ctrl+Y と Ctrl+Shift+Z の両方へ明示バインド（BUG-006）。
    // 既定の historyKeymap は Windows で redo を Ctrl+Y のみに割り当てるため補う
    Prec.highest(
      keymap.of([
        { key: "Mod-y", run: redo, preventDefault: true },
        { key: "Mod-Shift-z", run: redo, preventDefault: true },
      ]),
    ),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    ...extraExtensions,
  ];
  if (onDocChanged) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onDocChanged(update.state.doc.toString());
      }),
    );
  }

  const createState = (doc: string) =>
    EditorState.create({ doc, extensions });

  const view = new EditorView({ state: createState(initialDoc), parent });

  return {
    getContent: () => view.state.doc.toString(),
    setContent: (text) => view.setState(createState(text)),
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
