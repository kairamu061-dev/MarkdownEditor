# settings/store 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| serde / serde_json | スキーマとシリアライズ | 導入済み。`#[serde(default)]` で前方互換を確保 |
| tauri の PathResolver | app_config_dir の解決 | OS ごとの設定ディレクトリ規約に従う |

## アーキテクチャ

```
src-tauri/src/
└── settings.rs   # Settings スキーマ・load/save 純関数・コマンド・テスト
```

- `load(path) -> Settings` / `save(path, &Settings) -> Result` はファイルパスを引数に取る純関数とし、
  ユニットテストでは一時ディレクトリを使う
- コマンドは `settings_path(app)`（app_config_dir/settings.json）を解決して純関数に委譲する

## データ構造

```rust
#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub last_vault: Option<String>,
    pub editor: EditorSettings,
}

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct EditorSettings {
    pub font_family: Option<String>,
    pub font_size: Option<u32>,
}
```

## インターフェース

```rust
// 純関数（vault-restore からも使用）
pub fn load(path: &Path) -> Settings;                       // 失敗時 Default
pub fn save(path: &Path, s: &Settings) -> Result<(), String>;
pub fn settings_path(app: &AppHandle) -> Result<PathBuf, String>;

// コマンド
#[tauri::command] fn get_settings(app) -> Settings;
#[tauri::command] fn save_settings(app, settings: Settings) -> Result<(), String>;
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| serde / serde_json | 導入済み |
