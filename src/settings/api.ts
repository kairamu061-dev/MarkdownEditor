import { invoke } from "@tauri-apps/api/core";

export interface EditorSettings {
  fontFamily: string | null;
  fontSize: number | null;
}

export interface Settings {
  lastVault: string | null;
  editor: EditorSettings;
}

export const getSettings = () => invoke<Settings>("get_settings");
export const saveEditorSettings = (editor: EditorSettings) =>
  invoke<void>("save_editor_settings", { editor });
