# app-shell タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

- [x] Tauri 2 + Vite + TypeScript プロジェクトのスキャフォールド
- [x] tauri.conf.json のウィンドウ設定（タイトル・サイズ・ビルドターゲット）
- [x] nord.css（パレット定義）と app.css（レイアウト）の作成
- [x] 2 ペインレイアウトの HTML/CSS 実装
- [x] サイドバー開閉トグル（ボタン + Ctrl+B）の実装
- [x] Linux 上での `tauri dev` 起動確認と `tauri build` 通過確認
- [x] フレームレス化（decorations:false）＋自作タイトルバー（☰・タイトル・ドラッグ領域・最小化/最大化/閉じる）
- [x] capabilities に window 操作・start-dragging 権限を追加、titlebar.ts で配線
- [ ] Windows 実機でのタイトルバー操作・端リサイズ確認

## 依存関係

- スキャフォールド → 他のすべてのタスク
- nord.css / app.css → 2 ペインレイアウト → サイドバートグル
