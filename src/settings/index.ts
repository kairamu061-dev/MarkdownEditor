import {
  getSettings,
  saveEditorSettings,
  type EditorSettings,
} from "./api";

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 32;
const FONT_SIZE_DEFAULT = 14;

let currentEditor: EditorSettings = { fontFamily: null, fontSize: null };

function applyEditorSettings(editor: EditorSettings): void {
  const style = document.documentElement.style;
  if (editor.fontFamily) {
    style.setProperty("--editor-font-family", editor.fontFamily);
  } else {
    style.removeProperty("--editor-font-family");
  }
  if (editor.fontSize) {
    style.setProperty("--editor-font-size", `${editor.fontSize}px`);
  } else {
    style.removeProperty("--editor-font-size");
  }
}

function openModal(): void {
  const overlay = document.createElement("div");
  overlay.className = "settings-overlay";

  const modal = document.createElement("div");
  modal.className = "settings-modal";

  const title = document.createElement("h2");
  title.className = "settings-title";
  title.textContent = "設定";

  const sizeField = document.createElement("label");
  sizeField.className = "settings-field";
  sizeField.textContent = "フォントサイズ";
  const sizeInput = document.createElement("input");
  sizeInput.type = "number";
  sizeInput.min = String(FONT_SIZE_MIN);
  sizeInput.max = String(FONT_SIZE_MAX);
  sizeInput.value = String(currentEditor.fontSize ?? FONT_SIZE_DEFAULT);
  sizeField.appendChild(sizeInput);

  const familyField = document.createElement("label");
  familyField.className = "settings-field";
  familyField.textContent = "フォントファミリー";
  const familyInput = document.createElement("input");
  familyInput.type = "text";
  familyInput.placeholder = "システムフォント";
  familyInput.value = currentEditor.fontFamily ?? "";
  familyField.appendChild(familyInput);

  const error = document.createElement("div");
  error.className = "settings-error";
  error.hidden = true;

  const buttons = document.createElement("div");
  buttons.className = "settings-buttons";
  const cancel = document.createElement("button");
  cancel.textContent = "キャンセル";
  const save = document.createElement("button");
  save.className = "primary";
  save.textContent = "保存";
  buttons.append(cancel, save);

  modal.append(title, sizeField, familyField, error, buttons);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  sizeInput.focus();

  const close = () => {
    overlay.remove();
    window.removeEventListener("keydown", onKeydown);
  };
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  window.addEventListener("keydown", onKeydown);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  cancel.addEventListener("click", close);

  save.addEventListener("click", async () => {
    const rawSize = Number(sizeInput.value) || FONT_SIZE_DEFAULT;
    const fontSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, rawSize));
    const fontFamily = familyInput.value.trim() || null;
    const editor: EditorSettings = {
      fontSize: fontSize === FONT_SIZE_DEFAULT ? null : fontSize,
      fontFamily,
    };
    try {
      await saveEditorSettings(editor);
      currentEditor = editor;
      applyEditorSettings(editor);
      close();
    } catch (e) {
      console.error("save_editor_settings failed:", e);
      error.textContent = "設定の保存に失敗しました";
      error.hidden = false;
    }
  });
}

export function initSettings(): void {
  const header = document.querySelector<HTMLElement>(".sidebar-header");
  if (header) {
    const gear = document.createElement("button");
    gear.className = "sidebar-gear-button";
    gear.title = "設定";
    gear.textContent = "⚙";
    gear.addEventListener("click", openModal);
    header.appendChild(gear);
  }

  void getSettings()
    .then((settings) => {
      currentEditor = settings.editor;
      applyEditorSettings(settings.editor);
    })
    .catch((e) => console.error("get_settings failed:", e));
}
