use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub last_vault: Option<String>,
    pub editor: EditorSettings,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct EditorSettings {
    pub font_family: Option<String>,
    pub font_size: Option<u32>,
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
    fs::write(path, json).map_err(|e| e.to_string())
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
            editor: EditorSettings {
                font_family: Some("Meiryo".into()),
                font_size: Some(16),
            },
        };
        save(&path, &settings).unwrap();
        assert_eq!(load(&path), settings);
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
