# settings/theme-io 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| `tauri-plugin-dialog`（Rust 側） | ファイルの選択・保存ダイアログ | 導入済み。`file-explorer/vault` の「保管庫を開く」が同じ仕組み（`app.dialog().file().blocking_pick_folder()`）。フロントに新しい依存を足さずに済む |
| Rust 側でファイル入出力、**検証は TS 側** | 読み書きと妥当性判断の分担 | ダイアログとファイル I/O は Rust にしか無い。一方で色の検証は `settings/theme` の `isValidColor` が既にあり、**検証器を 2 つ持たない**ことを優先する |
| JSON（拡張子 `.json`） | テーマファイル | 人が読める・手で書ける。`settings.json` と同じ扱いで統一 |

## アーキテクチャ

```
src/settings/
├── theme-io.ts        # 新規: テーマファイルの組み立て・解析・検証
├── palette.ts         # 既存 + 利用者テーマを含めた「選べるテーマ」の解決
├── theme.ts           # 既存 + user: の解決を追加
├── theme-section.ts   # 既存 + 3 ボタン（エクスポート / インポート / 削除）
└── api.ts             # 既存 + export_theme_file / import_theme_file
src-tauri/src/
├── settings.rs        # ThemeSettings に user_themes を追加
└── theme_io.rs        # 新規: ダイアログ + ファイル読み書きコマンド
```

処理の流れ:

```
エクスポート
  モーダルの draft → resolvedColors() で 23 色に解決
    → buildThemeFile(name, dark, colors) で JSON 文字列
      → export_theme_file(json, defaultName)  … Rust が保存ダイアログ + 書き込み

インポート
  import_theme_file()  … Rust がファイル選択ダイアログ + 読み込み → 文字列
    → parseThemeFile(text) で検証（TS）
      → 成功: draft.userThemes に追加し、draft.preset = "user:<名前>" → applyTheme
      → 失敗: モーダルにエラー表示（draft は変えない）
```

**Rust は「ダイアログを出して文字列を渡す／受け取って書く」だけ**にする。
テーマファイルの妥当性は一切見ない。`settings/theme` で
「未知のキー・不正な色を捨てる判断は TS 側に寄せる」としたのと同じ理由で、
判断を 1 か所にまとめる。

## データ構造

```typescript
// theme-io.ts
export const THEME_FILE_FORMAT = "markdown-editor-theme";
export const THEME_FILE_VERSION = 1;

export interface ThemeFile {
  format: typeof THEME_FILE_FORMAT;
  version: number;
  name: string;
  dark: boolean;
  colors: Record<ColorKey, string>;
}

/** 取り込み結果。filled は既定値で補った項目数（spec.md のエラーケース） */
export type ParseResult =
  | { ok: true; theme: UserTheme; filled: number }
  | { ok: false; message: string };

// palette.ts / api.ts と同型
export interface UserTheme {
  name: string;
  dark: boolean;
  colors: Record<string, string>;   // 23 項目。ColorKey だが型は string
}

// api.ts — ThemeSettings が 3 つ目のフィールドを持つ
export interface ThemeSettings {
  preset: string | null;
  colors: Record<string, string>;
  userThemes: UserTheme[];          // 登録順
}
```

```rust
// settings.rs
#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct UserTheme {
    pub name: String,
    pub dark: bool,
    pub colors: BTreeMap<String, String>,
}

pub struct ThemeSettings {
    pub preset: Option<String>,
    pub colors: BTreeMap<String, String>,
    pub user_themes: Vec<UserTheme>,   // #[serde(default)]
}
```

`UserTheme` の各フィールドに `#[serde(default)]` を付け、項目が欠けていても
デシリアライズが失敗しないようにする。**ただし型そのものが違う場合
（`colors` が文字列など）は `theme` 全体が既定に落ちる** — これは
`editor.fontSize` など既存のフィールドと同じ性質で、ここだけ強くしても意味がない。
名前が空の要素は TS 側で捨てる。

## 利用者テーマの解決

`preset` の値の解釈を 1 か所（`theme.ts`）にまとめる。

```typescript
export type ThemeChoice =
  | { kind: "preset"; preset: Preset }
  | { kind: "user"; theme: UserTheme };

/** preset 文字列を解決する。未知・存在しない利用者テーマは Nord に落ちる */
export function resolveChoice(theme: ThemeSettings | null): ThemeChoice;
```

- `"user:"` で始まる → 残りを名前として `userThemes` から探す。
  **見つからなければ Nord**（テーマを消したあとに残った `preset` を拾わない）
- それ以外 → 既存の `isPresetName` で判定し、未知なら Nord

`resolvedColors()` は「選ばれたテーマの 23 色 + 項目ごとの上書き」に変わる。
利用者テーマも組み込みプリセットも、この段では同じ「23 色の土台」として扱う。
`applyTheme()` が読む `dark` も同様に `ThemeChoice` から取る。

**`ThemeSettings` に `userThemes` が入っているので、`applyTheme(theme)` は
引数だけで完結する。** モジュール外の状態を見に行かない。

## インターフェース

```typescript
// src/settings/theme-io.ts
export function buildThemeFile(name: string, dark: boolean,
                               colors: Record<ColorKey, string>): string;   // JSON 文字列
export function parseThemeFile(text: string, existingNames: string[]): ParseResult;
/** 重複しない名前にする（"X" → "X (2)" → "X (3)"） */
export function uniqueName(name: string, existing: string[]): string;

// src/settings/api.ts
/** 保存ダイアログを出して書き込む。キャンセルなら false */
export const exportThemeFile: (json: string, defaultName: string) => Promise<boolean>;
/** ファイル選択ダイアログを出して中身を返す。キャンセルなら null */
export const importThemeFile: () => Promise<string | null>;
```

```rust
// src-tauri/src/theme_io.rs
#[tauri::command]
pub fn export_theme_file(app: tauri::AppHandle, json: String, default_name: String)
    -> Result<bool, String>;
#[tauri::command]
pub fn import_theme_file(app: tauri::AppHandle) -> Result<Option<String>, String>;
```

ダイアログは `blocking_save_file` / `blocking_pick_file` に
`add_filter("テーマファイル", &["json"])` を付ける。
`vault.rs` の `blocking_pick_folder` と同じく、コマンド本体は同期でよい。

## 検証（`parseThemeFile`）

順に見て、最初に落ちた時点でメッセージを返す（spec.md のエラーケースと対応）。

1. JSON として解析できるか
2. `format` が `markdown-editor-theme` か
3. `version` が 1 以下か
4. `name` が空でない文字列か
5. `dark` が真偽値か
6. `colors` がオブジェクトか
7. `colors` の各値: **`isValidColor` を通らない値が 1 つでもあれば拒否**
   （`settings/theme` の検証器をそのまま使う。2 つ目を作らない）
8. 知らないキーは捨てる
9. 足りないキーは `dark` に応じて Nord / ライトの色で埋め、その件数を返す

`sanitizeOverrides` は**使わない。** あれは「自分が書いた設定を黙って直す」用で、
外から来たファイルには不向き（不正な値を黙って捨ててしまう）。

## モーダルでの扱い

エクスポート・インポート・削除は、いずれも**モーダルの draft に対して働く**。

- インポート・削除は `draft.userThemes` を書き換え、`applyTheme(draft)` でプレビュー
- 「保存」で `saveThemeSettings(draft)`、キャンセルで**スナップショットに戻す**
  （＝取り込みも削除も取り消される）
- **エクスポートだけは例外で、ファイルはキャンセルしても残る。**
  ファイルの書き出しは取り消せない外向きの操作なので、モーダルの取り消しとは
  切り離す。spec.md に明記した

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| settings/theme | `ColorKey` / `COLOR_ITEMS` / `PRESETS` / `isValidColor` / `applyTheme` |
| settings/store | `save_theme_settings`（`userThemes` を含めて保存） |
| settings/ui | 設定モーダル本体 |
| `tauri-plugin-dialog` | ファイルの選択・保存ダイアログ |
