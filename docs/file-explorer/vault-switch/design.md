# file-explorer/vault-switch 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| 既存 settings（Rust） | recentVaults の永続化 | 保管庫の記憶は settings/store の責務。`last_vault` と同じ経路に相乗り |
| 既存 vault コマンド | 保管庫の解決・ツリー構築 | `open_vault` / `pick_vault` が VaultInfo を返すため再利用 |
| 素の DOM | プルダウン UI | 軽量方針（フレームワークレス）。コンテキストメニューと同じ実装様式 |

## アーキテクチャ

- フロント（`src/explorer/index.ts`）
  - `renderVaultSwitcher(name)`: サイドバー下部の `#sidebar-footer`（index.html に追加）へ
    保管庫名ボタン（＋キャレット）を描画。メニューはフッタの上へ上方向に展開
  - `openSwitcher(anchor)`: `getSettings()` で `recentVaults` / `lastVault` を取得し、プルダウンを生成
  - `switchToVault(path)` / `openVaultByDialog()`: `open_vault` / `pick_vault` を呼び `applyVault` へ
  - `applyVault(info)`: 保管庫切り替えの共通処理（currentPath・collapsedDirs をリセットし、エディタを空に）
  - `showRecentItemMenu(e, path, anchor)`: 履歴項目の右クリックメニュー（2026-07-12 追加）。
    `.context-menu` の既存スタイルを再利用。「履歴から削除」→ `remove_recent_vault` →
    `openSwitcher(anchor)` を呼び直して一覧を開いたまま更新。現在の保管庫では出さない
- バックエンド（`src-tauri/src/vault.rs`）
  - `open_vault(path)`: 指定パスを検証（is_dir）→ VaultInfo 構築 → `remember_vault` → ルート設定
  - `remember_vault`: `last_vault` 更新に加え `recent_vaults` を新しい順・重複なし・最大 10 件で維持
  - `remove_recent_vault(path)`: `recent_vaults` から指定パスを除去して保存（2026-07-12 追加）。
    `last_vault` とディスク上のフォルダには触れない

## データ構造

```
// settings.json（settings/store）
Settings {
  lastVault: string | null,
  recentVaults: string[],   // 新しい順・重複なし・最大 10 件（絶対パス）
  editor: { ... }
}
```

## インターフェース

```
// Rust コマンド
open_vault(path: String) -> Result<VaultInfo, String>          // 追加
remove_recent_vault(path: String) -> Result<(), String>        // 2026-07-12 追加

// フロント api.ts
openVault(path: string): Promise<VaultInfo>
getSettings(): Promise<Settings>   // recentVaults を含む
removeRecentVault(path: string): Promise<void>
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| settings/store | recentVaults / lastVault の読み書き |
| file-explorer/vault | 保管庫の解決・ツリー構築（open_vault / pick_vault） |
| tauri-plugin-dialog | 「別の保管庫を開く…」のフォルダ選択 |
