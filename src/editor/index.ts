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
import { nordTheme, nordHighlightStyle, darkCompartment, darkTheme } from "./theme";
import { SCRATCH_DOC } from "./scratch";
import { noSingleDashSetext } from "./setext";

export interface MountOptions {
  initialDoc?: string;
  /** live-preview 等の追加拡張。core のコード変更なしで注入する */
  extraExtensions?: Extension[];
  /** 変更のたびに全文を通知する（file-explorer の保存処理が使用） */
  onDocChanged?: (content: string) => void;
}

/** タブ切り替え用に退避した編集状態。中身は core の外では触らない（editor/tabs） */
export interface EditorSession {
  readonly state: EditorState;
  /** スクロール位置はビュー側にあり EditorState に含まれないため別に持つ */
  readonly scrollTop: number;
}

export interface EditorHandle {
  getContent(): string;
  /** undo 履歴をリセットして内容を差し替える（ファイル切り替え用） */
  setContent(text: string): void;
  focus(): void;
  /** ライト/ダークの切り替え（CodeMirror の既定スタイルの明暗が変わる） */
  setDark(dark: boolean): void;
  /** 現在の編集状態（undo 履歴・選択・スクロール位置）を退避する */
  saveSession(): EditorSession;
  /** 退避した編集状態へ戻す。明暗は現在の設定に合わせ直す */
  restoreSession(session: EditorSession): void;
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
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      extensions: [noSingleDashSetext],
    }),
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

  // 既定はダーク。settings/theme のプリセットに合わせて setDark で差し替える。
  // setContent は setState で作り直すため、Compartment の中身は
  // extensions に埋め込まず、状態を作るたびに現在値から組み立てる
  let dark = true;
  const createState = (doc: string) =>
    EditorState.create({
      doc,
      extensions: [...extensions, darkCompartment.of(darkTheme(dark))],
    });

  const view = new EditorView({ state: createState(initialDoc), parent });

  return {
    getContent: () => view.state.doc.toString(),
    setContent: (text) => view.setState(createState(text)),
    focus: () => view.focus(),
    setDark: (next) => {
      dark = next;
      view.dispatch({ effects: darkCompartment.reconfigure(darkTheme(next)) });
    },
    saveSession: () => ({ state: view.state, scrollTop: view.scrollDOM.scrollTop }),
    restoreSession: (session) => {
      // setState はトランザクションを経由しないので onDocChanged は呼ばれない（切り替えで保存は走らない）
      view.setState(session.state);
      // 裏にいる間に配色プリセットが変わっていても、現在の明暗に揃える
      view.dispatch({ effects: darkCompartment.reconfigure(darkTheme(dark)) });
      // setState 直後は高さの計測前で、ここで戻しても効かない
      requestAnimationFrame(() => {
        view.scrollDOM.scrollTop = session.scrollTop;
      });
    },
    destroy: () => view.destroy(),
  };
}
