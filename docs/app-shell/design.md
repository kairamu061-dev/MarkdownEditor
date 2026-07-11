# app-shell 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| Tauri 2 | アプリフレームワーク | プロジェクト全体方針（docs/project_overview.md 参照） |
| Vite | フロントエンドビルド | Tauri 公式推奨。高速な HMR |
| TypeScript（素の DOM 操作） | UI 実装 | 省メモリ方針のため UI フレームワーク不使用 |

## アーキテクチャ

```
src/                     # フロントエンド
├── main.ts              # エントリポイント。レイアウト初期化とショートカット登録
├── shell/
│   ├── sidebar.ts       # サイドバー開閉の状態とトグル処理
│   └── titlebar.ts      # カスタムタイトルバーの最小化/最大化/閉じるを配線
└── styles/
    ├── nord.css         # Nord パレットの CSS カスタムプロパティ定義（唯一の色定義元）
    └── app.css          # レイアウト・タイトルバー・共通コンポーネントスタイル

src-tauri/               # バックエンド
├── tauri.conf.json      # ウィンドウ設定（decorations:false / dragDropEnabled:false 等）
├── capabilities/
│   └── default.json     # 権限（window 操作・start-dragging を許可）
└── src/
    ├── main.rs          # エントリポイント
    └── lib.rs           # Tauri Builder 構成（コマンドは後続エリアで追加）
```

- 色は必ず `nord.css` の `--nord0`〜`--nord15` と用途別エイリアス（`--bg-primary` 等）を参照する。ハードコード禁止
- ショートカットはフロントエンド側の `keydown` リスナで処理（グローバルショートカットは不要）

### フレームレスウィンドウ / カスタムタイトルバー

- `tauri.conf.json` の window で `decorations: false`（OS 枠を消す）。タイトルバーは HTML/CSS で自作
- ドラッグ移動はタイトルバー要素の `data-tauri-drag-region` 属性で実現（`core:window:allow-start-dragging` が必要）
- 最小化/最大化/閉じるは `@tauri-apps/api/window` の `getCurrentWindow()` から
  `minimize()` / `toggleMaximize()` / `close()` を呼ぶ（対応する `core:window:allow-*` 権限が必要）
- 最大化状態は `isMaximized()` で取得しアイコンを ▢/❐ に同期（`onResized` で更新）
- `dragDropEnabled: false` は OS のファイルドロップ処理を無効化し、WebView 内の HTML5 ドラッグ&ドロップ
  （file-explorer のノート/フォルダ移動）を機能させるための設定（BUG-005）

## データ構造

```typescript
// サイドバーの UI 状態（app-shell で持つ状態はこれのみ）
interface ShellState {
  sidebarVisible: boolean; // 初期値 true
}
```

## インターフェース

```typescript
// src/shell/sidebar.ts
export function initSidebar(root: HTMLElement): void; // トグルボタンと Ctrl+B を配線
export function toggleSidebar(): void;

// src/shell/titlebar.ts
export function initTitlebar(): void; // 最小化/最大化/閉じるボタンを配線（Tauri 外では no-op）
```

Tauri コマンド（IPC）は app-shell では定義しない。

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| @tauri-apps/api ^2 | Tauri フロントエンド API |
| @tauri-apps/cli ^2 (dev) | 開発・ビルド CLI |
| vite / typescript (dev) | ビルドツールチェーン |
| tauri ^2 (Rust) | アプリフレームワーク |
