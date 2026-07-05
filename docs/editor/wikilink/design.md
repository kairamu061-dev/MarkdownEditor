# editor/wikilink 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| ViewPlugin + Decoration | リンク表示・括弧の隠蔽 | live-preview と同方式。文書テキスト不変更 |
| 正規表現 + syntaxTree 除外判定 | `[[...]]` の検出 | lang-markdown に wikilink 構文がないため自前検出。コード内はノード名で除外 |

## アーキテクチャ

```
src/editor/wikilink.ts   # wikilink(onOpen): Extension
```

- 可視範囲のテキストに `/\[\[([^\[\]]+)\]\]/g` を適用して検出
- 検出位置の構文ノードを syntaxTree で確認し、InlineCode / FencedCode / CodeText 配下なら除外
- 選択が `[[...]]` 全体と重ならないとき: `[[` `]]` を Decoration.replace で隠し、
  内側に `cm-wikilink cm-wikilink-rendered` クラス + `data-note` 属性の mark を付与
- 選択が重なるとき: 内側に `cm-wikilink` クラスのみ（括弧は見える）
- `EditorView.domEventHandlers` の mousedown で `.cm-wikilink-rendered` を検出したら
  `onOpen(name)` を呼び、デフォルトのカーソル移動を抑止
- editor はヴォールトを知らない。名前解決は main.ts が配線する file-explorer 側の
  `openNoteByName(name)`（tree-view に追加）が担う

## データ構造

```typescript
// 追加する公開フック（src/explorer/index.ts）
export async function openNoteByName(name: string): Promise<void>;
// ツリーを深さ優先で探索し `${name}.md`（大文字小文字無視）に一致する最初のノートを開く
```

## インターフェース

```typescript
// src/editor/wikilink.ts
export function wikilink(onOpen: (name: string) => void): Extension;

// 使用側（src/main.ts）
mountEditor(el, { extraExtensions: [livePreview(), wikilink((n) => void openNoteByName(n))] });
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| @codemirror/view / state / language | 導入済みの範囲内。追加依存なし |
| file-explorer/tree-view | openNoteByName フック |
