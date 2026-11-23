# editor/tabs タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [x] T1: core に `saveSession` / `restoreSession` を追加する（`src/editor/index.ts`）
- [x] T2: `src/editor/tabs.ts` を作る（タブの並び・セッション保持・タブバー描画・キー操作）
- [x] T3: `index.html` に `#tab-bar` を追加し、`app.css` にタブバーのスタイルを書く
- [x] T4: explorer の `openNote` をタブ対応にし、`settleSave` / `selectTab` / `closeTab` / `openNoteInNewTab` を追加する
- [x] T5: 追随（`remapPrefix` → `tabs.remap`、`closeNotesUnder`、`applyVault` の `closeAll` と保存確定）
- [x] T6: ツリーのノート行の中クリック、右クリックメニュー「新しいタブで開く」
- [x] T7: `main.ts` の配線
- [x] T8: `tsc --noEmit` を通す
- [~] T9: Windows 動作確認チェックリストを書き、結果を test-cases.md に反映する

## 依存関係

- T1 → T2（tabs.ts はセッション API を使う）
- T2 → T4 → T5 / T6（explorer は TabsHandle を使う）
- T2〜T6 → T7 → T8 → T9
