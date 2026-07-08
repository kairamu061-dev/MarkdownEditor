# file-explorer/vault-switch タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [x] settings に `recentVaults` フィールド追加（Rust / TS 双方）
- [x] `remember_vault` で recentVaults を新しい順・重複なし・最大 10 件維持
- [x] `open_vault(path)` コマンド追加と lib.rs への登録
- [x] api.ts に `openVault` ラッパ追加、Settings 型に recentVaults 追加
- [x] `renderVaultSwitcher` / `openSwitcher` / `switchToVault` / `applyVault` の実装
- [x] スイッチャ用 CSS（プルダウン・現在項目強調・区切り線）
- [x] 外側クリック / Esc での閉じ処理
- [ ] Windows 11 実機での切り替え動作確認（test-cases E-01）

## 依存関係

- settings/store（recentVaults）→ open_vault → スイッチャ UI → 検証
- file-explorer/tree-view の完了が前提（保管庫表示の土台）
