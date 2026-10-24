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
├── scratch.ts      # スクラッチ文書の初期内容（定数）
└── setext.ts       # パーサ拡張: `-` 1 文字の下線見出しを無効にする（BUG-035）
```

### `-` 1 文字の下線見出しを無効にする（setext.ts）

`markdown({ extensions: [noSingleDashSetext] })` で Lezer のパーサに渡す `MarkdownConfig`。

- `parseBlock` に `after: "SetextHeading"` のリーフパーサを 1 つ足す。このファクトリは自分の
  パーサを返さず、直前に生成された SetextHeading のインスタンス（`leaf.parsers` の末尾）を
  ラッパーに差し替える。ラッパーは行が `-` 1 文字（＋空白）なら `false` を返し、
  その行は段落の続きとして取り込まれる。それ以外は本体へ委譲する
- SetextHeading そのものを `remove` / 同名で置き換えない。Lezer の水平線判定は
  「既定の SetextHeading が有効か」を見て段落直下の `---` を見出しに譲っているので、
  置き換えると `文章` + `---` が水平線に変わってしまう
- 「末尾がそのインスタンス」は Lezer の内部順序に依存する。ライブラリ更新時は
  test-cases の E-09 で確認する

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
