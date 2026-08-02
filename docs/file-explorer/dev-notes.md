# {機能エリア名} 開発メモ

## 実装上の判断

<!-- なぜその実装にしたかを記述する -->

| 判断内容 | 理由 |
|----------|------|
|          |      |

## 発生した問題と対処

<!-- 詰まった点・解決方法を記述する -->

| 問題 | 対処 |
|------|------|
| フォルダリネームで配下の開いているノートのパスが追随せず保存不能（BUG-013、実機検出） | `index.ts` に `remapAfterRename(from,to)` を追加し、`startRename` 確定時にノート/フォルダ問わず `currentPath`・`collapsedDirs` を旧→新プレフィックスで付け替え。DnD 用 `remapPaths` と `remapPrefix` に共通化（`2ecbe00`） |
| 保存失敗中のノート切替で別ノートを誤上書きしうる（BUG-014、コードレビュー 2.1） | `flushSave` の catch を `state.currentPath === path` のときだけ `pendingContent` 復元にガード。切替後は復元しない |
| ウィキリンク `[[note.md]]`・`[[sub/note]]` が開けない（BUG-015、コードレビュー 3.2） | `openNoteByName` を「末尾 `.md` なら二重補完しない」「`node.name` に加え `/` 正規化した `node.path` とも照合」に変更 |
| リネーム入力の blur で入力名が黙って破棄（BUG-016、コードレビュー 3.3） | blur を `commitFromBlur`（妥当かつ変更ありなら確定・他はキャンセル）に変更。`submitting` フラグで Enter/blur の二重確定を防止 |
| 終了時に debounce 待ちの編集が消える（BUG-017、コードレビュー §1） | `initExplorer` で `getCurrentWindow().onCloseRequested` を購読し `preventDefault→flushSave→destroy`。`capabilities/default.json` に `core:window:allow-destroy` 追加 |
| インラインリンクがフォルダを捨てて解決（BUG-019、コードレビュー §3） | `main.ts` で `base` を作らず `name`（フォルダ付き）を `openNoteByName` にそのまま渡す。ウィキリンクと同一挙動 |
| `settings.json` 非アトミック書き込み（BUG-020、コードレビュー §4） | `settings.rs` の `save` を temp ファイル→`fs::rename` のアトミック置換に変更。クラッシュ時も破損しない |
| symlink で無限再帰 / 保管庫外アクセス（BUG-021、コードレビュー §5） | `build_tree` を `entry.file_type()` ベースにしリンクをスキップ（無限再帰防止）。`resolve_in_vault` に `guard_within_vault`（canonical で保管庫配下を確認、未存在は最深祖先で判定、root 非 canonical 時は no-op）。Unix テスト 2 件追加 |
| ドロップ先ちらつき / status がツリー再描画で消える（BUG-022、コードレビュー §6） | `dragleave` を `row.contains(e.relatedTarget)` で判定。`clearContainerKeepStatus()` で `.explorer-status` を退避して再付与 |

> BUG-018（table-preview の全文再走査、コードレビュー §2）は editor 側の修正。選択変更時の再構築を `tableAt`（カーソルのテーブル所属）が変化したときだけに絞った（`src/editor/table-preview.ts`）。

> 2026-07-31 のコードレビュー（`tmp/コードレビュー結果.md`）指摘のうち妥当な 4 件（3.1/2.1/3.2/3.3）を修正。
> 指摘 4.1（table-preview の全文スキャン）は観察は妥当だが、提案の「ViewPlugin で可視範囲」は block デコレーションが plugin から提供不可のため不成立。別設計が要るため今回は見送り（低優先）。

## 設計からの変更点

<!-- 設計書との差分と理由を記述する -->

| 変更内容 | 理由 |
|----------|------|
|          |      |

## 今後の課題

<!-- 現状の制限・将来対応すべき事項を記述する -->

- **同名ノートが複数階層にあるときのバレ名リンク解決先**（enhancement・低優先）: `openNoteByName` はディレクトリ先行の深さ優先で走査するため、`note.md` がルートと `sub/` の両方にある場合、ファイル名のみ指定（`[[note]]`/`[[note.md]]`）は先に見つかった深い方（`sub/note.md`）に解決する。パス指定（`[[sub/note]]`）で曖昧性は回避可。必要なら「同階層優先／最短パス優先」等のルールを検討（2026-08-01 実機検証 §2 補足。不具合ではなく既存挙動）。

## ユーザへの要望

<!-- スキル・権限・情報が不足した場合に記録する -->

-
