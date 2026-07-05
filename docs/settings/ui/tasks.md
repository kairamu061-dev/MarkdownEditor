# settings/ui タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [x] save_editor_settings コマンド（store へ追加）
- [x] api.ts / settings.css / index.ts（モーダル・適用）
- [x] theme.ts の CSS 変数参照化と main.ts / index.html への配線
- [x] E2E 検証（フォント変更の即反映と再起動後の維持）

## 依存関係

- settings/store の完了が前提
- コマンド → UI → 配線 → 検証
