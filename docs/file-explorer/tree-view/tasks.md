# file-explorer/tree-view タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [x] api.ts（vault コマンドの型付きラッパ）
- [x] explorer.css（ツリー・ボタン・ステータス）
- [x] index.ts（保管庫オープン・ツリー描画・ノートを開く）
- [x] 保存（デバウンス自動保存・Ctrl+S・切り替え時フラッシュ）
- [x] main.ts / index.html への配線
- [x] E2E 検証（MDE_VAULT でテスト用保管庫を開き、編集 → 自動保存をディスクで確認）
- [x] 開閉状態を JS 側（collapsedDirs）で保持し再描画で失わない（BUG-002 修正）
- [x] 開閉マークを左端に配置、フォルダ/ノートの見た目差別化、階層インデントガイド
- [x] ドラッグ&ドロップ移動（`move_path`・移動先ハイライト・自身/子孫ガード・パス付け替え）
- [ ] Windows 11 実機での DnD 移動・見た目の確認

## 依存関係

- file-explorer/vault の完了が前提
- api.ts → index.ts → 配線 → 検証
- DnD 移動は vault の `move_path` に依存
