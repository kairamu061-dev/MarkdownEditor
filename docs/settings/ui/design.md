# settings/ui 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| 素の TypeScript + DOM | モーダル | プロジェクト方針 |
| CSS カスタムプロパティ | フォント適用 | editor/core の theme.ts を変数参照の最小変更に留められる |

## アーキテクチャ

```
src/settings/
├── index.ts       # initSettings: 読み込み・適用・⚙ ボタン・モーダル
├── api.ts         # get_settings / save_editor_settings の型付きラッパ
└── settings.css   # モーダル・オーバーレイのスタイル
```

- 適用は `document.documentElement.style.setProperty` で行う
- editor/core の theme.ts は `.cm-scroller` に
  `fontFamily: var(--editor-font-family, inherit)` / `fontSize: var(--editor-font-size, 14px)` を指定（最小変更）
- lastVault の競合を避けるため、UI からの保存は `save_editor_settings(editor)` を使う
  （Rust 側でファイルを読み直し editor フィールドだけ差し替えて保存。store に追加）

## データ構造

```typescript
// api.ts — store の Settings と同型
interface EditorSettings { fontFamily: string | null; fontSize: number | null }
interface Settings { lastVault: string | null; editor: EditorSettings }
```

## インターフェース

```typescript
// src/settings/index.ts
export function initSettings(): void; // 起動時に main.ts から呼ぶ

// Rust 側（settings.rs に追加）
#[tauri::command] fn save_editor_settings(app, editor: EditorSettings) -> Result<(), String>;
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| settings/store | get_settings / save_editor_settings |
| editor/core theme.ts | CSS 変数参照（フォールバック付き） |
