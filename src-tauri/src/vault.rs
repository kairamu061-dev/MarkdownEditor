use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

pub struct VaultState(pub Mutex<Option<PathBuf>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    name: String,
    /// 保管庫相対パス（区切りは '/'）
    path: String,
    is_dir: bool,
    children: Vec<TreeNode>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultInfo {
    name: String,
    tree: Vec<TreeNode>,
}

/// 相対パスを保管庫ルート配下に解決する。`..`・絶対パスは拒否する
fn resolve_in_vault(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return Err("path is outside the vault".into());
    }
    let mut out = root.to_path_buf();
    for comp in rel_path.components() {
        match comp {
            Component::Normal(c) => out.push(c),
            Component::CurDir => {}
            _ => return Err("path is outside the vault".into()),
        }
    }
    Ok(out)
}

/// 移動先の絶対パスを計算し、フォルダを自身の子孫へ移す不正な移動を弾く。
/// 副作用のない純粋関数（テスト用に分離）
fn move_destination(
    from_path: &Path,
    from_is_dir: bool,
    dest_dir: &Path,
) -> Result<PathBuf, String> {
    let name = from_path.file_name().ok_or("invalid source")?;
    let dest = dest_dir.join(name);
    if from_is_dir && dest.starts_with(from_path) {
        return Err("cannot move a folder into itself".into());
    }
    Ok(dest)
}

fn ensure_md(path: &Path) -> Result<(), String> {
    let is_md = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("md"));
    if is_md {
        Ok(())
    } else {
        Err("not a markdown file".into())
    }
}

fn build_tree(dir: &Path, rel_prefix: &str) -> Result<Vec<TreeNode>, String> {
    let mut nodes = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        let rel = if rel_prefix.is_empty() {
            name.clone()
        } else {
            format!("{rel_prefix}/{name}")
        };
        if path.is_dir() {
            let children = build_tree(&path, &rel)?;
            nodes.push(TreeNode { name, path: rel, is_dir: true, children });
        } else if ensure_md(&path).is_ok() {
            nodes.push(TreeNode { name, path: rel, is_dir: false, children: Vec::new() });
        }
    }
    nodes.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(nodes)
}

fn vault_info(root: &Path) -> Result<VaultInfo, String> {
    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| root.to_string_lossy().into_owned());
    Ok(VaultInfo { name, tree: build_tree(root, "")? })
}

fn current_root(state: &State<'_, VaultState>) -> Result<PathBuf, String> {
    state
        .0
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "vault is not open".into())
}

fn set_root(state: &State<'_, VaultState>, root: PathBuf) {
    *state.0.lock().unwrap() = Some(root);
}

/// 最近開いた保管庫として記録する数の上限
const MAX_RECENT_VAULTS: usize = 10;

/// lastVault と recentVaults を更新する。失敗してもオープン処理はブロックしない
fn remember_vault(app: &tauri::AppHandle, root: &Path) {
    let result = crate::settings::settings_path(app).and_then(|path| {
        let mut settings = crate::settings::load(&path);
        let root_str = root.to_string_lossy().into_owned();
        settings.last_vault = Some(root_str.clone());
        // 新しい順・重複なしで先頭に積み、上限で切り詰める
        settings.recent_vaults.retain(|v| v != &root_str);
        settings.recent_vaults.insert(0, root_str);
        settings.recent_vaults.truncate(MAX_RECENT_VAULTS);
        crate::settings::save(&path, &settings)
    });
    if let Err(e) = result {
        eprintln!("failed to remember vault: {e}");
    }
}

/// 最近の保管庫一覧（recentVaults）から指定パスを取り除く。
/// lastVault とディスク上のフォルダには触れない（履歴のみの削除）
#[tauri::command]
pub fn remove_recent_vault(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let settings_path = crate::settings::settings_path(&app)?;
    let mut settings = crate::settings::load(&settings_path);
    settings.recent_vaults.retain(|v| v != &path);
    crate::settings::save(&settings_path, &settings)
}

#[tauri::command]
pub async fn pick_vault(
    app: tauri::AppHandle,
    state: State<'_, VaultState>,
) -> Result<Option<VaultInfo>, String> {
    let Some(picked) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let root = picked.into_path().map_err(|e| e.to_string())?;
    let info = vault_info(&root)?;
    remember_vault(&app, &root);
    set_root(&state, root);
    Ok(Some(info))
}

/// 指定パスの保管庫を開く（最近の保管庫一覧からの切り替え用）
#[tauri::command]
pub fn open_vault(
    app: tauri::AppHandle,
    state: State<'_, VaultState>,
    path: String,
) -> Result<VaultInfo, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err("vault folder not found".into());
    }
    let info = vault_info(&root)?;
    remember_vault(&app, &root);
    set_root(&state, root);
    Ok(info)
}

#[tauri::command]
pub fn initial_vault(
    app: tauri::AppHandle,
    state: State<'_, VaultState>,
) -> Result<Option<VaultInfo>, String> {
    // 解決順: 起動引数 > MDE_VAULT > 記憶した lastVault（spec 参照）
    let candidate = std::env::args()
        .nth(1)
        .or_else(|| std::env::var("MDE_VAULT").ok())
        .or_else(|| {
            crate::settings::settings_path(&app)
                .ok()
                .and_then(|path| crate::settings::load(&path).last_vault)
        })
        .map(PathBuf::from)
        .filter(|p| p.is_dir());
    match candidate {
        Some(root) => {
            let info = vault_info(&root)?;
            remember_vault(&app, &root);
            set_root(&state, root);
            Ok(Some(info))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn list_tree(state: State<'_, VaultState>) -> Result<Vec<TreeNode>, String> {
    build_tree(&current_root(&state)?, "")
}

#[tauri::command]
pub fn read_note(state: State<'_, VaultState>, rel_path: String) -> Result<String, String> {
    let path = resolve_in_vault(&current_root(&state)?, &rel_path)?;
    ensure_md(&path)?;
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_note(
    state: State<'_, VaultState>,
    rel_path: String,
    content: String,
) -> Result<(), String> {
    let path = resolve_in_vault(&current_root(&state)?, &rel_path)?;
    ensure_md(&path)?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(state: State<'_, VaultState>, rel_path: String) -> Result<(), String> {
    let path = resolve_in_vault(&current_root(&state)?, &rel_path)?;
    ensure_md(&path)?;
    if path.exists() {
        return Err("already exists".into());
    }
    fs::write(&path, "").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_folder(state: State<'_, VaultState>, rel_path: String) -> Result<(), String> {
    let path = resolve_in_vault(&current_root(&state)?, &rel_path)?;
    if path.exists() {
        return Err("already exists".into());
    }
    fs::create_dir(&path).map_err(|e| e.to_string())
}

/// ノート（.md）またはフォルダのリネーム。同じ親ディレクトリ内での改名を想定
#[tauri::command]
pub fn rename_path(
    state: State<'_, VaultState>,
    from: String,
    to: String,
) -> Result<(), String> {
    let root = current_root(&state)?;
    let from_path = resolve_in_vault(&root, &from)?;
    let to_path = resolve_in_vault(&root, &to)?;
    if !from_path.exists() {
        return Err("not found".into());
    }
    // ファイルは .md のみ許可。フォルダは拡張子を問わない
    if from_path.is_file() {
        ensure_md(&from_path)?;
        ensure_md(&to_path)?;
    }
    if to_path.exists() {
        return Err("already exists".into());
    }
    fs::rename(&from_path, &to_path).map_err(|e| e.to_string())
}

/// ノートまたはフォルダを別フォルダ配下へ移動する（ドラッグ&ドロップ用）。
/// `to_dir` は移動先フォルダの相対パス（空文字はルート）
#[tauri::command]
pub fn move_path(
    state: State<'_, VaultState>,
    from: String,
    to_dir: String,
) -> Result<(), String> {
    let root = current_root(&state)?;
    let from_path = resolve_in_vault(&root, &from)?;
    if !from_path.exists() {
        return Err("not found".into());
    }
    let dest_dir = if to_dir.is_empty() {
        root.clone()
    } else {
        let d = resolve_in_vault(&root, &to_dir)?;
        if !d.is_dir() {
            return Err("destination is not a folder".into());
        }
        d
    };
    let dest = move_destination(&from_path, from_path.is_dir(), &dest_dir)?;
    if dest == from_path {
        return Ok(()); // 同じ場所へのドロップは何もしない
    }
    if dest.exists() {
        return Err("already exists".into());
    }
    fs::rename(&from_path, &dest).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_path(state: State<'_, VaultState>, rel_path: String) -> Result<(), String> {
    let path = resolve_in_vault(&current_root(&state)?, &rel_path)?;
    if !path.exists() {
        return Err("not found".into());
    }
    if path.is_file() {
        ensure_md(&path)?;
    }
    trash::delete(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_accepts_nested_relative_path() {
        let root = Path::new("/vault");
        let resolved = resolve_in_vault(root, "a/b.md").unwrap();
        assert_eq!(resolved, PathBuf::from("/vault/a/b.md"));
    }

    #[test]
    fn resolve_rejects_parent_traversal() {
        let root = Path::new("/vault");
        assert!(resolve_in_vault(root, "../escape.md").is_err());
        assert!(resolve_in_vault(root, "a/../../escape.md").is_err());
    }

    #[test]
    fn resolve_rejects_absolute_path() {
        let root = Path::new("/vault");
        assert!(resolve_in_vault(root, "/etc/passwd").is_err());
    }

    #[test]
    fn ensure_md_checks_extension() {
        assert!(ensure_md(Path::new("note.md")).is_ok());
        assert!(ensure_md(Path::new("note.MD")).is_ok());
        assert!(ensure_md(Path::new("note.txt")).is_err());
        assert!(ensure_md(Path::new("folder")).is_err());
    }

    #[test]
    fn move_destination_joins_basename_into_target_dir() {
        // ノートを別フォルダへ移動: from の basename が移動先フォルダ配下に付く
        let from = Path::new("/vault/a/note.md");
        let dest_dir = Path::new("/vault/b");
        assert_eq!(
            move_destination(from, false, dest_dir).unwrap(),
            PathBuf::from("/vault/b/note.md")
        );
    }

    #[test]
    fn move_destination_rejects_folder_into_own_subtree() {
        // フォルダ a を a/b 配下へ移動しようとすると弾く
        let from = Path::new("/vault/a");
        let dest_dir = Path::new("/vault/a/b");
        assert!(move_destination(from, true, dest_dir).is_err());
    }

    #[test]
    fn move_destination_allows_folder_into_sibling() {
        let from = Path::new("/vault/a");
        let dest_dir = Path::new("/vault/c");
        assert_eq!(
            move_destination(from, true, dest_dir).unwrap(),
            PathBuf::from("/vault/c/a")
        );
    }

    #[test]
    fn build_tree_sorts_and_filters() {
        let dir = std::env::temp_dir().join(format!("vault-test-{}", std::process::id()));
        fs::create_dir_all(dir.join("zeta")).unwrap();
        fs::create_dir_all(dir.join(".hidden")).unwrap();
        fs::write(dir.join("beta.md"), "").unwrap();
        fs::write(dir.join("Alpha.md"), "").unwrap();
        fs::write(dir.join("ignored.txt"), "").unwrap();
        fs::write(dir.join("zeta/child.md"), "").unwrap();

        let tree = build_tree(&dir, "").unwrap();
        let names: Vec<&str> = tree.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["zeta", "Alpha.md", "beta.md"]);
        assert_eq!(tree[0].children[0].path, "zeta/child.md");

        fs::remove_dir_all(&dir).unwrap();
    }
}
