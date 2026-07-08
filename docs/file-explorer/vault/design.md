# file-explorer/vault 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| tauri-plugin-dialog | フォルダ選択ダイアログ | Tauri 公式プラグイン。ネイティブダイアログ |
| trash クレート | ごみ箱への移動 | 完全削除を避ける（誤操作からの復旧可能性）。クロスプラットフォーム対応 |

## アーキテクチャ

```
src-tauri/src/
├── lib.rs      # Builder 構成にコマンド登録・State 管理を追加
└── vault.rs    # 保管庫状態・パス検証・全コマンド・ユニットテスト
```

- 保管庫ルートは `tauri::State<Mutex<Option<PathBuf>>>` で保持
- パス検証は純関数 `resolve_in_vault(root, rel_path) -> Result<PathBuf>` に切り出してユニットテスト
- ツリー構築は再帰下降。`.` 始まりを除外し、フォルダ先行・名前昇順でソート

## データ構造

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TreeNode {
    name: String,
    path: String,      // 保管庫相対（区切りは '/'）
    is_dir: bool,
    children: Vec<TreeNode>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultInfo {
    name: String,          // 保管庫のフォルダ名
    tree: Vec<TreeNode>,
}
```

## インターフェース

```rust
// すべて Result<_, String>。エラー文字列は spec.md のエラーケース参照
#[tauri::command] async fn pick_vault(app, state) -> Option<VaultInfo>;
#[tauri::command] fn initial_vault(state) -> Option<VaultInfo>;
#[tauri::command] fn list_tree(state) -> Vec<TreeNode>;
#[tauri::command] fn read_note(state, rel_path: String) -> String;
#[tauri::command] fn write_note(state, rel_path: String, content: String);
#[tauri::command] fn create_note(state, rel_path: String);
#[tauri::command] fn rename_path(state, from: String, to: String);
#[tauri::command] fn delete_path(state, rel_path: String);
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| tauri-plugin-dialog ^2 (Rust + npm) | フォルダ選択 |
| trash ^5 | ごみ箱削除 |
