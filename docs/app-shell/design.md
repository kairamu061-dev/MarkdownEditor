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
│   └── sidebar.ts       # サイドバー開閉の状態とトグル処理
└── styles/
    ├── nord.css         # Nord パレットの CSS カスタムプロパティ定義（唯一の色定義元）
    └── app.css          # レイアウト・共通コンポーネントスタイル

src-tauri/               # バックエンド
├── tauri.conf.json      # ウィンドウ設定、ビルドターゲット
└── src/
    ├── main.rs          # エントリポイント
    └── lib.rs           # Tauri Builder 構成（コマンドは後続エリアで追加）
```

- 色は必ず `nord.css` の `--nord0`〜`--nord15` と用途別エイリアス（`--bg-primary` 等）を参照する。ハードコード禁止
- ショートカットはフロントエンド側の `keydown` リスナで処理（グローバルショートカットは不要）

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
```

Tauri コマンド（IPC）は app-shell では定義しない。

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| @tauri-apps/api ^2 | Tauri フロントエンド API |
| @tauri-apps/cli ^2 (dev) | 開発・ビルド CLI |
| vite / typescript (dev) | ビルドツールチェーン |
| tauri ^2 (Rust) | アプリフレームワーク |
