# editor/core 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| codemirror (^6) | エディタ基盤（基本拡張バンドル） | プロジェクト全体方針。Obsidian と同エンジン |
| @codemirror/lang-markdown | Markdown 言語サポート | 公式 Markdown パッケージ。GFM 拡張込み |
| @lezer/highlight | ハイライトタグ定義 | CodeMirror 6 標準のハイライト機構 |

## アーキテクチャ

```
src/editor/
├── index.ts        # 公開 API（mountEditor）。EditorView の生成・保持
├── theme.ts        # Nord テーマ（EditorView.theme + HighlightStyle）
└── scratch.ts      # スクラッチ文書の初期内容（定数）
```

- `index.ts` は CodeMirror の `Extension` 配列を組み立てる。追加拡張（live-preview 等）は
  `mountEditor` の引数 `extraExtensions` で外から注入する（core のコード変更なしで拡張可能）
- `theme.ts` の色は CSS カスタムプロパティ（`var(--accent)` 等）で指定し、nord.css を唯一の色定義元に保つ
- main.ts は `#main-content` に対して `mountEditor` を呼ぶ

## データ構造

```typescript
// エディタの状態は CodeMirror の EditorState に集約する。独自の状態は持たない
interface EditorHandle {
  getContent(): string;
  setContent(text: string): void; // undo 履歴をリセットして差し替え（ファイル切り替え用）
  focus(): void;
  destroy(): void;
}
```

## インターフェース

```typescript
// src/editor/index.ts
export interface MountOptions {
  initialDoc?: string;                    // 省略時はスクラッチ文書
  extraExtensions?: Extension[];          // live-preview 等の追加拡張
  onDocChanged?: (content: string) => void; // 変更のたびに呼ばれる（file-explorer の保存に使用）
}
export function mountEditor(parent: HTMLElement, options?: MountOptions): EditorHandle;
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| codemirror ^6 | エディタ基盤 |
| @codemirror/lang-markdown ^6 | Markdown パーサ・言語サポート |
| @lezer/highlight ^1 | ハイライトタグ |
