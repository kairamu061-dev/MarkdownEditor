# file-explorer/tree-view タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [x] api.ts（vault コマンドの型付きラッパ）
- [x] explorer.css（ツリー・ボタン・ステータス）
- [x] index.ts（ヴォールトオープン・ツリー描画・ノートを開く）
- [x] 保存（デバウンス自動保存・Ctrl+S・切り替え時フラッシュ）
- [x] main.ts / index.html への配線
- [x] E2E 検証（MDE_VAULT でテスト用ヴォールトを開き、編集 → 自動保存をディスクで確認）

## 依存関係

- file-explorer/vault の完了が前提
- api.ts → index.ts → 配線 → 検証
