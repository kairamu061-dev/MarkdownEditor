# file-explorer/vault タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [ ] tauri-plugin-dialog / trash の導入（Cargo.toml, package.json, capabilities）
- [ ] vault.rs（状態管理・パス検証・ツリー構築・全コマンド）
- [ ] lib.rs へのコマンド登録
- [ ] パス検証・ツリー構築のユニットテスト（cargo test）

## 依存関係

- プラグイン導入 → vault.rs → コマンド登録 → テスト
