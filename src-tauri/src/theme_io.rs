//! テーマファイルの読み書き。
//!
//! **このモジュールは中身を検証しない。** ダイアログを出してファイルを読む／書くだけで、
//! テーマファイルとして妥当かどうかはフロント側（`src/settings/theme-io.ts`）が見る。
//! 色の検証器（`isValidColor`）が既にフロントにあり、二重に持つとずれるため。

use std::fs;

use tauri_plugin_dialog::DialogExt;

const FILTER_NAME: &str = "テーマファイル";
const FILTER_EXT: [&str; 1] = ["json"];

/// 保存ダイアログを出して書き込む。キャンセルなら `Ok(false)`
#[tauri::command]
pub fn export_theme_file(
    app: tauri::AppHandle,
    json: String,
    default_name: String,
) -> Result<bool, String> {
    let Some(picked) = app
        .dialog()
        .file()
        .add_filter(FILTER_NAME, &FILTER_EXT)
        .set_file_name(sanitize_file_name(&default_name))
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = picked
        .into_path()
        .map_err(|e| format!("保存先を解決できません: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("書き込みに失敗しました: {e}"))?;
    Ok(true)
}

/// ファイル選択ダイアログを出して中身を返す。キャンセルなら `Ok(None)`
#[tauri::command]
pub fn import_theme_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let Some(picked) = app
        .dialog()
        .file()
        .add_filter(FILTER_NAME, &FILTER_EXT)
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|e| format!("ファイルを解決できません: {e}"))?;
    let text = fs::read_to_string(&path).map_err(|e| format!("読み込みに失敗しました: {e}"))?;
    Ok(Some(text))
}

/// テーマ名をそのままファイル名にすると、`/` などでダイアログが失敗しうる。
/// Windows で使えない文字を `_` に置き換え、`.json` を付ける
fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if (c as u32) < 0x20 => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.');
    let base = if trimmed.is_empty() { "theme" } else { trimmed };
    format!("{base}.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_replaces_path_characters() {
        assert_eq!(sanitize_file_name("Solarized"), "Solarized.json");
        assert_eq!(sanitize_file_name("a/b:c*d"), "a_b_c_d.json");
        assert_eq!(sanitize_file_name("Nord（ダーク）"), "Nord（ダーク）.json");
    }

    #[test]
    fn sanitize_falls_back_when_empty() {
        assert_eq!(sanitize_file_name(""), "theme.json");
        assert_eq!(sanitize_file_name("   "), "theme.json");
        assert_eq!(sanitize_file_name("..."), "theme.json");
    }
}
