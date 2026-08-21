import { invoke } from "@tauri-apps/api/core";

export interface EditorSettings {
  fontFamily: string | null;
  fontSize: number | null;
}

export interface ThemeSettings {
  /** 配色プリセット名。null は既定（nord） */
  preset: string | null;
  /**
   * 上書きした色だけを持つ。キーは palette.ts の ColorKey だが、
   * 型は string のまま — 古い settings.json に消えた項目名が残っていても
   * 読み込みを止めず、フロント側で捨てるため（Rust 側も検証しない）
   */
  colors: Record<string, string>;
}

export interface Settings {
  lastVault: string | null;
  recentVaults: string[];
  editor: EditorSettings;
  theme: ThemeSettings;
}

export const getSettings = () => invoke<Settings>("get_settings");
export const saveEditorSettings = (editor: EditorSettings) =>
  invoke<void>("save_editor_settings", { editor });
export const saveThemeSettings = (theme: ThemeSettings) =>
  invoke<void>("save_theme_settings", { theme });
