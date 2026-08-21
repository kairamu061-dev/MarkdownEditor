import { initSidebar } from "./shell/sidebar";
import { initTitlebar } from "./shell/titlebar";
import { mountEditor } from "./editor";
import { livePreview } from "./editor/live-preview";
import { codeBlockStyle } from "./editor/code-block";
import { tablePreview } from "./editor/table-preview";
import { wikilink } from "./editor/wikilink";
import { mountInlineTitle } from "./editor/inline-title";
import {
  initExplorer,
  explorerDocChanged,
  openNoteByName,
  onCurrentNoteChanged,
  renameCurrentNote,
} from "./explorer";
import { initSettings } from "./settings";
import { subscribeDark } from "./settings/theme";

initTitlebar();
initSidebar();
initSettings();
const editor = mountEditor(document.getElementById("main-content")!, {
  extraExtensions: [
    livePreview((href) => {
      if (/^https?:\/\//i.test(href)) return; // 外部 URL は未対応
      // 相対パスのノートリンク: 先頭 ./ を除いてそのまま解決に渡す。
      // フォルダを捨てず openNoteByName のパス照合に委ねる（ウィキリンクと同一挙動・BUG-019）
      const name = href.replace(/^\.\//, "");
      void openNoteByName(name);
    }),
    codeBlockStyle(),
    tablePreview(),
    wikilink((name) => void openNoteByName(name)),
  ],
  onDocChanged: explorerDocChanged,
});
editor.focus();
// 配色プリセットの明暗をエディタへ伝える。subscribeDark は登録時に現在値で
// 1 回呼ぶので、initSettings() が先に走っていても取りこぼさない
subscribeDark((dark) => editor.setDark(dark));

const noteTitle = mountInlineTitle(document.getElementById("note-title")!, {
  onRename: (name) => renameCurrentNote(name),
  onDone: () => editor.focus(),
});
onCurrentNoteChanged((path) => noteTitle.setPath(path));

initExplorer(document.getElementById("sidebar-content")!, editor);
