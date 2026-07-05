# settings/vault-restore 設計

## 技術選定

追加ライブラリなし（settings/store の純関数と vault.rs の既存構造を使用）。

## アーキテクチャ

- `vault.rs` に private ヘルパ `remember_vault(app, root)` を追加:
  `settings::load` → `last_vault` 更新 → `settings::save`。失敗は `eprintln!` のみ
- `pick_vault` / `initial_vault` の成功パスで `remember_vault` を呼ぶ
- `initial_vault` に `app: AppHandle` 引数を追加し、候補チェーンの最後に
  `settings::load(&settings_path(&app)).last_vault` を追加する
- フロントエンド（explorer/api.ts・index.ts）は変更なし

## データ構造

settings/store の `Settings.last_vault` を使用（新規の構造なし）。

## インターフェース

```rust
// vault.rs 内部
fn remember_vault(app: &tauri::AppHandle, root: &Path);

// シグネチャ変更（フロントの呼び出しは不変）
#[tauri::command]
pub fn initial_vault(app: tauri::AppHandle, state: State<'_, VaultState>)
    -> Result<Option<VaultInfo>, String>;
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| settings/store | load / save / settings_path |
