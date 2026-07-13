import { initSidebar } from "./shell/sidebar";
import { initTitlebar } from "./shell/titlebar";
import { mountEditor } from "./editor";
import { livePreview } from "./editor/live-preview";
import { codeBlockStyle } from "./editor/code-block";
import { tablePreview } from "./editor/table-preview";
import { wikilink } from "./editor/wikilink";
import { initExplorer, explorerDocChanged, openNoteByName } from "./explorer";
import { initSettings } from "./settings";

initTitlebar();
initSidebar();
initSettings();
const editor = mountEditor(document.getElementById("main-content")!, {
  extraExtensions: [
    livePreview((href) => {
      if (/^https?:\/\//i.test(href)) return; // 外部 URL は未対応
      // 相対パスのノートリンク: .md を除いてファイル名で検索
      const name = href.replace(/\.md$/i, "").replace(/^\.\//, "");
      const base = name.split(/[\\/]/).pop() ?? name;
      void openNoteByName(base);
    }),
    codeBlockStyle(),
    tablePreview(),
    wikilink((name) => void openNoteByName(name)),
  ],
  onDocChanged: explorerDocChanged,
});
editor.focus();
initExplorer(document.getElementById("sidebar-content")!, editor);
