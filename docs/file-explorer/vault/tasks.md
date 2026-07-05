# file-explorer/vault タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [x] tauri-plugin-dialog / trash の導入（Cargo.toml, package.json, capabilities）
- [x] vault.rs（状態管理・パス検証・ツリー構築・全コマンド）
- [x] lib.rs へのコマンド登録
- [x] パス検証・ツリー構築のユニットテスト（cargo test）

## 依存関係

- プラグイン導入 → vault.rs → コマンド登録 → テスト
