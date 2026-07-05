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
    /// ヴォールト相対パス（区切りは '/'）
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

/// 相対パスをヴォールトルート配下に解決する。`..`・絶対パスは拒否する
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
    set_root(&state, root);
    Ok(Some(info))
}

#[tauri::command]
pub fn initial_vault(state: State<'_, VaultState>) -> Result<Option<VaultInfo>, String> {
    let candidate = std::env::args()
        .nth(1)
        .or_else(|| std::env::var("MDE_VAULT").ok())
        .map(PathBuf::from)
        .filter(|p| p.is_dir());
    match candidate {
        Some(root) => {
            let info = vault_info(&root)?;
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
pub fn rename_path(
    state: State<'_, VaultState>,
    from: String,
    to: String,
) -> Result<(), String> {
    let root = current_root(&state)?;
    let from_path = resolve_in_vault(&root, &from)?;
    let to_path = resolve_in_vault(&root, &to)?;
    ensure_md(&from_path)?;
    ensure_md(&to_path)?;
    if to_path.exists() {
        return Err("already exists".into());
    }
    fs::rename(&from_path, &to_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_path(state: State<'_, VaultState>, rel_path: String) -> Result<(), String> {
    let path = resolve_in_vault(&current_root(&state)?, &rel_path)?;
    ensure_md(&path)?;
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
