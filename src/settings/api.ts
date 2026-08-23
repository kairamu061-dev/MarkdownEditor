import { invoke } from "@tauri-apps/api/core";

export interface EditorSettings {
  fontFamily: string | null;
  fontSize: number | null;
}

/** 取り込んだ配色。組み込みプリセットと同じ「23 色の土台」として扱う */
export interface UserTheme {
  name: string;
  /**
   * エディタの基底テーマの明暗。色だけでは足りない —
   * 明暗は CSS 変数ではなく EditorView.darkTheme で切り替えているため
   */
  dark: boolean;
  colors: Record<string, string>;
}

export interface ThemeSettings {
  /** 配色プリセット名。null は既定（nord）。利用者テーマは "user:<name>" */
  preset: string | null;
  /**
   * 上書きした色だけを持つ。キーは palette.ts の ColorKey だが、
   * 型は string のまま — 古い settings.json に消えた項目名が残っていても
   * 読み込みを止めず、フロント側で捨てるため（Rust 側も検証しない）
   */
  colors: Record<string, string>;
  /** 取り込んだ利用者テーマ（登録順） */
  userThemes: UserTheme[];
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

/** 保存ダイアログを出して書き込む。キャンセルなら false */
export const exportThemeFile = (json: string, defaultName: string) =>
  invoke<boolean>("export_theme_file", { json, defaultName });
/** ファイル選択ダイアログを出して中身を返す。キャンセルなら null */
export const importThemeFile = () => invoke<string | null>("import_theme_file");
