# settings/vault-restore タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [x] remember_vault ヘルパと pick_vault / initial_vault への組み込み
- [x] initial_vault の解決チェーンに lastVault を追加
- [x] E2E 検証（MDE_VAULT で起動 → 終了 → 引数なし再起動で復元。フォルダ削除時のフォールバック）

## 依存関係

- settings/store の完了が前提
