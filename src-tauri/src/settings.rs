use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub last_vault: Option<String>,
    /// 最近開いた保管庫のパス（新しい順・重複なし）。保管庫切り替えの一覧に使う
    #[serde(default)]
    pub recent_vaults: Vec<String>,
    pub editor: EditorSettings,
    pub theme: ThemeSettings,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct EditorSettings {
    pub font_family: Option<String>,
    pub font_size: Option<u32>,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct ThemeSettings {
    /// 配色プリセット名。None は既定（nord）
    pub preset: Option<String>,
    /// 利用者が上書きした色だけを持つ。**キーも値もここでは検証しない。**
    /// 項目名を enum にすると、将来項目を増減したときに古い settings.json で
    /// デシリアライズが失敗し theme 全体が既定に落ちる（＝配色が丸ごと消える）。
    /// 未知のキー・不正な色を捨てる判断はフロント側に置く。
    /// BTreeMap にしているのはキー順を安定させ、保存のたびに差分を出さないため
    pub colors: BTreeMap<String, String>,
}

/// 未存在・破損時はデフォルト値（起動をブロックしない）
pub fn load(path: &Path) -> Settings {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub fn save(path: &Path, settings: &Settings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    // 一時ファイルに書いてから rename する（アトミック置換）。書き込み中にプロセスが落ちても
    // 既存の settings.json が破損せず、lastVault / recentVaults を失わない（BUG-020）
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

pub fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("settings.json"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    Ok(load(&settings_path(&app)?))
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    save(&settings_path(&app)?, &settings)
}

/// editor フィールドのみ部分更新する（lastVault との書き込み競合を避ける）
#[tauri::command]
pub fn save_editor_settings(
    app: tauri::AppHandle,
    editor: EditorSettings,
) -> Result<(), String> {
    let path = settings_path(&app)?;
    let mut settings = load(&path);
    settings.editor = editor;
    save(&path, &settings)
}

/// theme フィールドのみ部分更新する（editor と同じく lastVault を巻き込まない）
#[tauri::command]
pub fn save_theme_settings(
    app: tauri::AppHandle,
    theme: ThemeSettings,
) -> Result<(), String> {
    let path = settings_path(&app)?;
    let mut settings = load(&path);
    settings.theme = theme;
    save(&path, &settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_file(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("settings-test-{}-{name}", std::process::id()))
    }

    #[test]
    fn load_returns_default_when_missing() {
        assert_eq!(load(Path::new("/nonexistent/settings.json")), Settings::default());
    }

    #[test]
    fn load_returns_default_when_corrupt() {
        let path = temp_file("corrupt.json");
        fs::write(&path, "{ not json !").unwrap();
        assert_eq!(load(&path), Settings::default());
        fs::remove_file(&path).unwrap();
    }

    #[test]
    fn save_and_load_round_trip() {
        let path = temp_file("roundtrip.json");
        let settings = Settings {
            last_vault: Some("/home/user/notes".into()),
            recent_vaults: vec!["/home/user/notes".into(), "/home/user/work".into()],
            editor: EditorSettings {
                font_family: Some("Meiryo".into()),
                font_size: Some(16),
            },
            theme: ThemeSettings {
                preset: Some("light".into()),
                colors: BTreeMap::from([
                    ("bgPrimary".to_string(), "#101010".to_string()),
                    ("heading1".to_string(), "#ff0000".to_string()),
                ]),
            },
        };
        save(&path, &settings).unwrap();
        assert_eq!(load(&path), settings);
        fs::remove_file(&path).unwrap();
    }

    #[test]
    fn theme_defaults_when_absent() {
        let path = temp_file("theme-absent.json");
        fs::write(&path, r#"{ "lastVault": "/v" }"#).unwrap();
        let settings = load(&path);
        assert_eq!(settings.theme, ThemeSettings::default());
        assert_eq!(settings.theme.preset, None);
        assert!(settings.theme.colors.is_empty());
        fs::remove_file(&path).unwrap();
    }

    /// 項目名を enum にしていたら、将来項目を消したときにここで失敗して
    /// theme 全体が既定に落ちる（＝利用者の配色が丸ごと消える）。
    /// 未知のキーはそのまま保持し、捨てる判断はフロント側に任せる
    #[test]
    fn theme_keeps_unknown_colour_keys() {
        let path = temp_file("theme-unknown.json");
        fs::write(
            &path,
            r##"{ "theme": { "preset": "nord", "colors": { "notAnItem": "#123456", "text": "#ffffff" } } }"##,
        )
        .unwrap();
        let settings = load(&path);
        assert_eq!(settings.theme.colors.get("notAnItem").map(String::as_str), Some("#123456"));
        assert_eq!(settings.theme.colors.get("text").map(String::as_str), Some("#ffffff"));
        fs::remove_file(&path).unwrap();
    }

    /// 色として妥当かどうかも Rust 側では見ない（フロントで捨てる）
    #[test]
    fn theme_keeps_invalid_colour_values() {
        let path = temp_file("theme-invalid.json");
        fs::write(&path, r#"{ "theme": { "colors": { "text": "notacolour" } } }"#).unwrap();
        let settings = load(&path);
        assert_eq!(settings.theme.colors.get("text").map(String::as_str), Some("notacolour"));
        fs::remove_file(&path).unwrap();
    }

    /// theme を保存しても lastVault / editor を巻き込まない（部分更新）
    #[test]
    fn saving_theme_preserves_other_fields() {
        let path = temp_file("theme-partial.json");
        let original = Settings {
            last_vault: Some("/home/user/notes".into()),
            recent_vaults: vec!["/home/user/notes".into()],
            editor: EditorSettings { font_family: Some("Meiryo".into()), font_size: Some(16) },
            theme: ThemeSettings::default(),
        };
        save(&path, &original).unwrap();

        let mut updated = load(&path);
        updated.theme = ThemeSettings {
            preset: Some("light".into()),
            colors: BTreeMap::from([("accent".to_string(), "#abcdef".to_string())]),
        };
        save(&path, &updated).unwrap();

        let reloaded = load(&path);
        assert_eq!(reloaded.last_vault, original.last_vault);
        assert_eq!(reloaded.recent_vaults, original.recent_vaults);
        assert_eq!(reloaded.editor, original.editor);
        assert_eq!(reloaded.theme.preset.as_deref(), Some("light"));
        fs::remove_file(&path).unwrap();
    }

    #[test]
    fn load_fills_missing_fields_with_defaults() {
        let path = temp_file("partial.json");
        fs::write(&path, r#"{ "lastVault": "/v", "unknownField": 1 }"#).unwrap();
        let settings = load(&path);
        assert_eq!(settings.last_vault.as_deref(), Some("/v"));
        assert_eq!(settings.editor, EditorSettings::default());
        fs::remove_file(&path).unwrap();
    }
}
