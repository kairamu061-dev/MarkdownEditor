import { initSidebar } from "./shell/sidebar";
import { mountEditor } from "./editor";
import { livePreview } from "./editor/live-preview";
import { codeBlockStyle } from "./editor/code-block";
import { initExplorer, explorerDocChanged } from "./explorer";
import { initSettings } from "./settings";

initSidebar(document.getElementById("app")!);
initSettings();
const editor = mountEditor(document.getElementById("main-content")!, {
  extraExtensions: [livePreview(), codeBlockStyle()],
  onDocChanged: explorerDocChanged,
});
editor.focus();
initExplorer(document.getElementById("sidebar-content")!, editor);
