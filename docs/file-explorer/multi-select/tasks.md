# file-explorer/multi-select タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [x] T1: selection.ts — 選択集合と操作関数
- [x] T2: selection.ts — 範囲選択（開始判定・四角の描画・当たり判定・自動スクロール・クリック抑止）
- [x] T3: index.ts — 行の `.selected` 表示、Ctrl+クリック、通常クリック・Esc・保管庫切り替えでの解除、再描画時の retain、remap
- [x] T4: index.ts — `dragPaths` 化、`movableTo`、まとめて移動と件数つきステータス、ドラッグ画像
- [x] T5: explorer.css — `.selected`・四角のスタイル
- [x] T6: headless で検証（範囲選択・クリック抑止・まとめて移動）し、test-cases.md を埋める
- [ ] T7: Windows 動作確認チェックリストを書く

## 依存関係

- T1 → T2, T3 → T4
- T1〜T5 → T6 → T7
