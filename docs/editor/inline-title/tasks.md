# editor/inline-title タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [ ] T-1 `index.html` に `#note-title` を追加し、`app.css` に `.note-title` / `.note-title-input` / `.note-title-empty` を定義
- [ ] T-2 `src/explorer/index.ts`: `state.currentPath` への代入を内部関数 `setCurrentPathInternal` に集約
- [ ] T-3 `src/explorer/index.ts`: `onCurrentNoteChanged(cb)` を追加し、T-2 の集約点から通知を発火
- [ ] T-4 `src/explorer/index.ts`: `flushSave` を `flushPendingSave` として公開
- [ ] T-5 `src/explorer/index.ts`: `renameCurrentNote(newBaseName)` を追加（flush → 検証 → rename → remap → refresh）
- [ ] T-6 `src/editor/inline-title.ts` を新規作成（表示・編集モード・キー操作・blur 確定）
- [ ] T-7 `src/main.ts` で配線し、初期表示（スクラッチ = 「無題」）を反映
- [ ] T-8 `src/explorer/file-ops.ts`: `startRename` の確定前に `flushSave` を追加（既存の同種リスクを塞ぐ）
- [ ] T-9 `npm run build`（`tsc && vite build`）が通ることを確認
- [ ] T-10 test-cases.md を作成し、devcontainer で確認できる範囲を実施
- [ ] T-11 Windows 実機での確認依頼を作成

## 依存関係

- T-1 → T-6（マウント先の DOM が必要）
- T-2 → T-3（代入の集約が通知の前提）
- T-3 → T-7（購読 API が配線の前提）
- T-4 → T-5（flush の公開が rename 実装の前提）
- T-5, T-6 → T-7（両者が揃ってから配線）
- T-7 → T-9 → T-10 → T-11

## ステータス

Todo
