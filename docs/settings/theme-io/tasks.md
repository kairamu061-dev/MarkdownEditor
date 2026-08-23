# settings/theme-io タスク

## 実装タスク一覧

<!-- ステータス: [ ] 未着手 / [~] 進行中 / [x] 完了 -->

### 1. データと永続化

- [x] `settings.rs` に `UserTheme`（name / dark / colors）を追加
- [x] `ThemeSettings` に `user_themes: Vec<UserTheme>` を追加
- [x] Rust テスト: 往復・欠損時の既定・項目が欠けた要素が落ちないこと・
      `user_themes` の保存が他フィールドを巻き込まないこと
- [ ] `api.ts` の `ThemeSettings` に `userThemes` を追加
- [x] **既存の `theme` 保存経路が壊れていないこと**（`userThemes` を持たない
      古い `settings.json` を読めること）

### 2. テーマの解決（利用者テーマを土台にできるようにする）

- [ ] `theme.ts` に `resolveChoice`（`user:` の解決・存在しなければ Nord）
- [ ] `resolvedColors` を「選ばれたテーマの 23 色 + 上書き」に変更
- [ ] `applyTheme` の `dark` を `ThemeChoice` から取る
- [ ] 既存の `resolvePreset` の呼び出し元を整理する

### 3. ファイル入出力（Rust）

- [x] `theme_io.rs` を作り `export_theme_file` / `import_theme_file` を実装
- [x] `lib.rs` に登録し、`.json` のフィルタを付ける
- [x] キャンセル時に `false` / `null` を返す（エラーにしない）

### 4. テーマファイルの組み立てと検証（TS）

- [ ] `theme-io.ts`: `buildThemeFile` / `parseThemeFile` / `uniqueName`
- [ ] 検証 9 段（spec.md のエラーケースと 1 対 1 で対応させる）
- [ ] 不正な色は拒否・知らないキーは捨てる・足りないキーは補って件数を返す
- [ ] `isValidColor` を再利用する（検証器を 2 つ作らない）

### 5. 設定モーダル

- [ ] プリセットの選択欄に利用者テーマを並べる（組み込み → 利用者の順）
- [ ] エクスポート / インポート ボタン
- [ ] 「このテーマを削除」（利用者テーマ選択時のみ表示）
- [ ] 削除したら Nord に切り替える
- [ ] 取り込み・削除は draft に対して行い、キャンセルで取り消される
- [ ] 補完したときの通知（「N 項目を既定値で補いました」）
- [ ] エラーメッセージの表示
- [ ] `settings.css` にボタンのスタイル

### 6. 仕上げ

- [ ] `docs/settings/theme/overview.md` の「作らないもの: 配色セットのファイル入出力」を外す
- [ ] `docs/settings/theme/spec.md` の未対応ケースからも外す
- [ ] `docs/settings/spec.md` の機能一覧に theme-io の行を追加
- [ ] 親（`docs/settings/`）の design.md / tasks.md にサブ項目リンクを追記
- [ ] test-cases.md を書く
- [ ] Windows 実機の確認チェックリストを作成

## 依存関係

- 1（データ）→ 2（解決）→ 5（UI）
  UI は利用者テーマを土台として解決できることが前提
- 3（Rust I/O）と 4（検証）は互いに独立。どちらも 5 の前
- 4 は 2 に依存する（補完に使う既定色を `PRESETS` から取るため）
- 6 は全部の後

## ステータス

未着手。
