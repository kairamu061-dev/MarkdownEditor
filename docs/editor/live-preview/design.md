# editor/live-preview 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| CodeMirror Decoration (replace) | 記法マークの隠蔽・置換 | 文書テキストを変更せず表示のみ差し替える標準機構 |
| ViewPlugin | 選択位置・ビューポート変化への追従 | 可視範囲のみ処理し軽量（省メモリ方針） |
| syntaxTree (@codemirror/language) | 記法ノードの特定 | lang-markdown が構築する構文木をそのまま利用 |

## アーキテクチャ

```
src/editor/
└── live-preview.ts   # livePreview(): Extension を公開。core へは main.ts から注入
```

- `ViewPlugin` が `docChanged` / `selectionSet` / `viewportChanged` のたびに可視範囲の構文木を走査し、
  DecorationSet を再構築する（全文走査はしない）
- 隠蔽は `Decoration.replace({})`、弾丸は `Decoration.replace({ widget: BulletWidget })`
- 選択との重なり判定は仕様の「表示/再表示の判定ルール」に従い、記法ノードの親範囲
  （Emphasis / StrongEmphasis / InlineCode / Strikethrough / Link / 見出し行）と全選択レンジを比較する
- 弾丸の色は `EditorView.baseTheme` で `.cm-list-bullet { color: var(--accent) }` を定義

## データ構造

```typescript
// 対象ノード → 隠蔽方法のマッピング（実装内の定数）
// HeaderMark        → 親 ATXHeading1..6。マーク + 直後の空白 1 つを隠す
// EmphasisMark      → 親 Emphasis / StrongEmphasis
// CodeMark          → 親 InlineCode
// StrikethroughMark → 親 Strikethrough
// Link              → 子の LinkMark と URL を隠す（リンクテキストだけ残す）
// ListMark          → 親が BulletList 配下の ListItem のとき • ウィジェットに置換
```

## インターフェース

```typescript
// src/editor/live-preview.ts
export function livePreview(): Extension;

// 使用側（src/main.ts）
mountEditor(el, { extraExtensions: [livePreview()] });
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| @codemirror/view / state / language | Decoration・ViewPlugin・syntaxTree（core 導入済みの範囲内。追加依存なし） |
