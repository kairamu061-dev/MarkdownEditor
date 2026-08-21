# settings/theme タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

### 1. 変数の整備（この段階では見た目が 1 ピクセルも変わらないこと）

- [ ] `nord.css` に `--heading1`〜`--heading6` を追加（既定値は現在の色と同じ）
- [ ] `nord.css` に `--code-keyword` / `--code-string` / `--code-comment` /
      `--code-number` / `--code-type` を追加
- [ ] `--comment` を廃止し `--code-comment` に統合（`color-mix` をやめて固定値）
- [ ] `--quote-text` / `--quote-bg` の混合元を `--text` / `--border` / `--quote-bar` に張り替え
- [ ] `editor/theme.ts` の見出し・コードの色を新変数へ差し替え
- [ ] `app.css:195` の `var(--nord3)` を `var(--border)` へ
- [ ] 検査: `grep -rn "var(--nord" src/ | grep -v styles/nord.css` が空になる
- [ ] 検査: 変更前後でスクリーンショットが一致する（配色が変わっていないこと）

### 2. データと永続化

- [ ] `settings.rs` に `ThemeSettings`（`preset` / `colors: BTreeMap`）を追加
- [ ] `save_theme_settings` コマンドを追加し `lib.rs` に登録
- [ ] Rust テスト: `theme` の往復・欠損時の既定・未知キーの保持
- [ ] `api.ts` に `ThemeSettings` 型と `saveThemeSettings` を追加

### 3. パレットと適用

- [ ] `palette.ts`: `COLOR_ITEMS`（21 項目）と `PRESETS`（nord / light）
- [ ] `theme.ts`: `applyTheme` / `resolvedColors` / `subscribeDark` / `isValidColor`
- [ ] 起動時に `applyTheme` を呼ぶ（`initSettings` 内）
- [ ] 未知のプリセット名・未知の項目名・不正な色値を捨てる処理

### 4. ライト/ダークの切り替え

- [ ] `editor/theme.ts` から `{ dark: true }` を外し `darkCompartment` を追加
- [ ] `EditorHandle.setDark` を追加
- [ ] `main.ts` で `subscribeDark` と繋ぐ
- [ ] ライトテーマで境界線・選択範囲・スクロールバーが破綻しないか目視

### 5. 設定モーダルの配色セクション

- [ ] プリセットの `<select>`
- [ ] 4 グループの折りたたみ（既定は「基本」のみ展開）
- [ ] 各項目の行（色見本 `<input type="color">` + 16 進入力 + 戻すボタン）
- [ ] 上書きのある項目の「●」表示
- [ ] 「すべて初期値に戻す」
- [ ] 変更時の即時プレビュー / キャンセル時の復元
- [ ] 保存時の色値の検証とエラー表示
- [ ] `settings.css` に配色セクションのスタイル

### 6. 仕上げ

- [ ] `docs/project_overview.md` の「カラーパレット」に新変数を反映
- [ ] `docs/settings/spec.md` の機能一覧に theme の行を追加
- [ ] `docs/settings/overview.md` の「作らないもの: テーマ切り替え（Nord ダーク固定のまま）」を修正
- [ ] 親（`docs/settings/`）の design.md / tasks.md にサブ項目リンクを追記
- [ ] `docs/settings/test-cases.md` にテストケースを追加
- [ ] Windows 実機の確認チェックリストを作成

## 依存関係

- 1（変数の整備）→ 3（適用）
  変数が無いと適用先が無い。1 だけを先に入れて「見た目が変わらないこと」を
  確認しておくと、後で配色が崩れたときに原因を切り分けられる
- 2（データ）→ 3（適用）→ 5（UI）
  UI は解決済みの色を初期表示に使うため、`resolvedColors` が先
- 4（dark 切り替え）は 3 に依存するが 5 とは独立。ライトテーマの破綻確認は
  UI が無くても `settings.json` を直接書けば試せる
- 6 は全部の後

## ステータス

未着手。
