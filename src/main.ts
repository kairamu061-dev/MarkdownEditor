import { initSidebar } from "./shell/sidebar";
import { mountEditor } from "./editor";
import { livePreview } from "./editor/live-preview";

initSidebar(document.getElementById("app")!);
mountEditor(document.getElementById("main-content")!, {
  extraExtensions: [livePreview()],
}).focus();
