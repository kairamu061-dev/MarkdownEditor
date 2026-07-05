import { initSidebar } from "./shell/sidebar";
import { mountEditor } from "./editor";
import { livePreview } from "./editor/live-preview";
import { initExplorer, explorerDocChanged } from "./explorer";
import { initSettings } from "./settings";

initSidebar(document.getElementById("app")!);
initSettings();
const editor = mountEditor(document.getElementById("main-content")!, {
  extraExtensions: [livePreview()],
  onDocChanged: explorerDocChanged,
});
editor.focus();
initExplorer(document.getElementById("sidebar-content")!, editor);
