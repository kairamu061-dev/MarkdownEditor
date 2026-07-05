# editor/live-preview タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [ ] live-preview.ts の ViewPlugin / Decoration 実装（見出し・強調・打ち消し・コード）
- [ ] インラインリンクの整形（LinkMark / URL の隠蔽）
- [ ] 箇条書きマークの • ウィジェット置換
- [ ] main.ts への注入
- [ ] Xvfb でカーソル内/外の 2 状態をスクリーンショット検証

## 依存関係

- editor/core の完了が前提
- ViewPlugin 実装 → リンク整形 / 弾丸置換 → 注入 → 検証
