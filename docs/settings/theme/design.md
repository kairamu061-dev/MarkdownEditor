# settings/theme 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| CSS カスタムプロパティ + `documentElement.style` | 配色の適用 | `settings/ui` のフォント適用と同じ手口。`nord.css` の既定値を残したまま実行時に上から被せられる。CSS ファイル側は「唯一の色定義元」のまま |
| `<input type="color">` | カラーピッカー | OS 標準のピッカーが出る。自前の HSV ピッカーを書かずに済む。素の DOM 方針にも合う |
| `EditorView.darkTheme` ファセット + `Compartment` | ライト/ダークの切り替え | `EditorView.theme(spec, { dark })` の `dark` はこのファセットを立てているだけ。ファセットだけを Compartment に入れれば、テーマ定義を作り直さずに再構成できる |
| `color-mix(in srgb, …)` | 引用の本文色・背景の導出 | 引用は 3 色で「引用らしさ」を出しているが、設定項目を 3 つに増やしたくない。バー色 1 つから導出する |

## アーキテクチャ

```
src/styles/nord.css        # 既定値（Nord）。--heading1..6 / --code-* を新設
src/settings/
├── index.ts               # 既存。配色セクションをモーダルに追加
├── palette.ts             # 新規: 項目定義（22 個）とプリセット 2 種
├── theme.ts               # 新規: 適用・購読・上書きの解決
├── api.ts                 # 既存 + save_theme_settings
└── settings.css           # 既存 + 配色セクションのスタイル
src/editor/
├── theme.ts               # --heading1..6 / --code-* を参照。dark を Compartment 化
└── index.ts               # EditorHandle に setDark を追加
src-tauri/src/settings.rs   # ThemeSettings + save_theme_settings コマンド
```

適用の流れ:

```
起動   get_settings() → theme.applyTheme(settings.theme)
                        ├→ プリセットの色を documentElement に設定
                        ├→ 上書きの色で更に上書き
                        └→ dark フラグを購読者へ通知 → editor.setDark()

保存   モーダルで変更 → 即 applyTheme（プレビュー）
       保存    → save_theme_settings(theme)
       キャンセル → 開いたときの ThemeSettings で applyTheme し直す
```

**プリセットの色も CSS 変数として明示的に設定する。** `nord.css` の既定値に頼って
「Nord のときは何も設定しない」とはしない — ライトから Nord へ戻すときに
`removeProperty` の取りこぼしが起きやすく、片方の色だけ残る事故になるため。
22 項目は常に全部設定する。

## データ構造

```typescript
// palette.ts
export type ColorKey =
  | "bgPrimary" | "bgSidebar" | "bgHover" | "border" | "text" | "textStrong"
  | "heading1" | "heading2" | "heading3" | "heading4" | "heading5" | "heading6"
  | "codeKeyword" | "codeString" | "codeComment" | "codeNumber" | "codeType"
  | "accent" | "accentSecondary" | "syntaxMark" | "quote" | "error";

export type ColorGroup = "basic" | "heading" | "code" | "other";

export interface ColorItem {
  key: ColorKey;
  cssVar: string;   // "--bg-primary" など
  label: string;    // 設定画面の表示名
  group: ColorGroup;
}

export const COLOR_ITEMS: readonly ColorItem[];        // 22 個・spec.md の表と同順
export type PresetName = "nord" | "light";
export interface Preset { name: PresetName; label: string; dark: boolean; colors: Record<ColorKey, string> }
export const PRESETS: Record<PresetName, Preset>;
export const DEFAULT_PRESET: PresetName = "nord";

// api.ts / Rust 側と同型
export interface ThemeSettings {
  preset: string | null;                  // null は既定（nord）
  colors: Partial<Record<string, string>>; // 上書きのみ。キーは ColorKey の文字列
}
```

```rust
// settings.rs
#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct ThemeSettings {
    pub preset: Option<String>,
    /// 上書きした色のみ。キー・値とも検証しない（不明キーは TS 側で捨てる）
    pub colors: std::collections::BTreeMap<String, String>,
}
```

**`colors` を `BTreeMap<String, String>` にして Rust 側では検証しない。** 項目名を
enum にすると、将来項目を増減したときに古い `settings.json` で
デシリアライズが失敗し、`theme` 全体が既定に落ちる。未知のキーを捨てるだけで済む
TS 側に判断を寄せる（spec.md のエラーケース「未知の項目名は無視して読み込みを続ける」）。
`BTreeMap` はキー順が安定するので、保存のたびに `settings.json` の差分が出ない。

## インターフェース

```typescript
// src/settings/theme.ts
/** ThemeSettings を解決して documentElement に適用し、dark 購読者へ通知する */
export function applyTheme(theme: ThemeSettings | null): void;
/** 現在の解決済みの色（プリセット + 上書き）。設定画面の初期表示に使う */
export function resolvedColors(theme: ThemeSettings | null): Record<ColorKey, string>;
/** dark/light の変化を購読する。登録時に現在値で 1 回呼ぶ */
export function subscribeDark(listener: (dark: boolean) => void): void;
/** "#rrggbb" 形式か検証する（大文字小文字は問わない） */
export function isValidColor(value: string): boolean;

// src/settings/api.ts
export const saveThemeSettings: (theme: ThemeSettings) => Promise<void>;

// src/editor/index.ts — EditorHandle に追加
setDark(dark: boolean): void;
```

```rust
// settings.rs — editor と同じく部分更新（lastVault を巻き込まない）
#[tauri::command]
pub fn save_theme_settings(app: tauri::AppHandle, theme: ThemeSettings) -> Result<(), String>;
```

## nord.css / editor/theme.ts の変更

新設する変数と、既定値をどこから取るか:

| 変数 | 既定値 | 現状 |
|------|--------|------|
| `--heading1` | `var(--nord13)` | `--warning` を参照していた |
| `--heading2` | `var(--nord14)` | `--success` を参照していた |
| `--heading3` | `var(--nord15)` | `--nord15` を**直接**参照していた |
| `--heading4` | `var(--nord8)` | `--accent` を参照していた |
| `--heading5` | `var(--nord9)` | `--accent-secondary` を参照していた |
| `--heading6` | `var(--nord9)` | `--accent-secondary` を参照していた |
| `--code-keyword` | `var(--nord9)` | `--accent-secondary` を参照していた |
| `--code-string` | `var(--nord14)` | `--success` を参照していた |
| `--code-comment` | `color-mix(--text 40%, --border)` | `--comment` から改名。混合元を `--nord4`/`--nord3` から張り替え（実効値は同じ `#848c9d`） |
| `--code-number` | `var(--nord15)` | `--nord15` を**直接**参照していた |
| `--code-type` | `var(--nord7)` | `--nord7` を**直接**参照していた |

**既定値は現在の見た目と同じ色にする。** この変更だけでは配色は 1 ピクセルも変わらず、
調整口が増えるだけ、という状態を保つ。

あわせて、エイリアス層を迂回している 4 箇所を解消する:

| 箇所 | 現状 | 変更後 |
|------|------|--------|
| `editor/theme.ts` heading3 | `var(--nord15)` | `var(--heading3)` |
| `editor/theme.ts` number/bool/atom | `var(--nord15)` | `var(--code-number)` |
| `editor/theme.ts` typeName/className | `var(--nord7)` | `var(--code-type)` |
| `styles/app.css:195` | `var(--nord3)` | `var(--border)` |

`--nordN` の直接参照が残っていると、利用者が上書きしてもその箇所だけ Nord のまま残る。
**残り 0 件になったことを検査する**（`grep -rn "var(--nord" src/ | grep -v styles/nord.css` が空）。

### color-mix の張り替え

| 変数 | 現状 | 変更後 |
|------|------|--------|
| `--comment` | `color-mix(--nord4 / --nord3)` | `--code-comment` に改名し、混合元を `--text` / `--border` へ |
| `--quote-text` | `color-mix(--nord4 / --nord3)` | `color-mix(--text / --border)` |
| `--quote-bg` | `color-mix(--nord9 10%)` | `color-mix(--quote-bar 10%)` |
| `--scrollbar-thumb` | `var(--nord3)` | `var(--border)`（同じ色） |
| `--scrollbar-thumb-hover` | `var(--nord10)` | `var(--syntax-mark)`（同じ色） |

`--quote-bar` 自体は設定項目「引用」そのもの。ここを変えると本文色と背景も追従する。
スクロールバーの 2 つは**現状と同じ色になる**ように張り替え先を選んだので、
この段階では見た目が変わらない。

## ライト/ダークの切り替え

`editor/theme.ts` の `EditorView.theme(spec, { dark: true })` から `dark` を外し、
別に Compartment を持つ。

```typescript
// editor/theme.ts
export const darkCompartment = new Compartment();
export const nordTheme = EditorView.theme({ /* 変更なし */ });   // dark 指定を外す
// editor/index.ts の extensions に
darkCompartment.of(EditorView.darkTheme.of(true)),
// EditorHandle.setDark
setDark: (dark) => view.dispatch({ effects: darkCompartment.reconfigure(EditorView.darkTheme.of(dark)) }),
```

`main.ts` で `subscribeDark((dark) => editor.setDark(dark))` を繋ぐ。
`initSettings()` はエディタより先に走るので、**購読は登録時に現在値で 1 回呼ぶ**
仕様にして順序依存を消す。

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| settings/store | `get_settings` / `save_theme_settings` |
| settings/ui | 設定モーダル本体（配色セクションを追加する先） |
| editor/core theme.ts | 新変数の参照・`darkTheme` の Compartment |
| `@codemirror/state` `Compartment` | dark フラグの再構成 |
