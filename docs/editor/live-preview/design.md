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
└── live-preview.ts   # livePreview(onLinkClick): Extension を公開。core へは main.ts から注入
```

- `ViewPlugin` が `docChanged` / `selectionSet` / `viewportChanged` のたびに可視範囲の構文木を走査し、
  DecorationSet を再構築する（全文走査はしない）
- 隠蔽は `Decoration.replace({})`、弾丸は `Decoration.replace({ widget: BulletWidget })`
- 選択との重なり判定は仕様の「表示/再表示の判定ルール」に従い、記法ノードの親範囲
  （Emphasis / StrongEmphasis / InlineCode / Strikethrough / Link / 見出し行）と全選択レンジを比較する
- 弾丸の色は `EditorView.baseTheme` で `.cm-list-bullet { color: var(--accent) }` を定義

### 箇条書きのインデント

構文木の走査（ノード単位）とは別に、可視範囲を**行単位**で 1 周する 2 パス目を持つ。
1 行が複数の ListItem / BulletList に跨るため、ノード単位のままでは行デコレーションが重複する。

行ごとに `resolveInner(行頭の空白の直後)` から親を辿り、BulletList / OrderedList の数を
段数 d（0 始まり）とする。祖先に BulletList が 1 つも無ければ対象外。

寸法は 3 つのデコレーションで作る。単位は原文の空白幅に依存させない。

| 対象 | デコレーション | 与える値 |
|------|----------------|----------|
| 行頭の空白 | `Decoration.mark`（**replace ではない**） | `display:inline-block; width: d * step` |
| 行 | `Decoration.line` | `padding-left: base + d * step + bulletWidth` |
| 行 | 同上 | `text-indent: -(行頭空白があれば d * step) - (弾丸行なら bulletWidth)` |
| 行 | 同上 | 段 1 以降は `background-image` に `linear-gradient` を d 本重ねて縦ガイド線 |

この組み合わせで

```
1 行目の左端      = padding - indent            = base + d * step        … 弾丸の位置
1 行目の本文開始  = padding - indent + 空白 + 弾丸 = base + d * step + bulletWidth
折り返し行の左端  = padding                      = base + d * step + bulletWidth
```

となり、本文と折り返しが**段数によらず**一致する。

判断の要点は 2 つ。

- 行頭空白は `Decoration.mark` で**幅だけ**を上書きする。`replace` にすると空白が本物の
  テキストでなくなり、カーソル移動・Backspace・Shift+Tab が壊れる。mark なら素の挙動が残る
- `text-indent` を弾丸ウィジェットの有無ではなく**構文木の段数**から決める。カーソルが乗って
  `-` がソース表示に戻っても行の左端が動かない（旧 `.cm-line:has(.cm-list-bullet)` は動いた）

ガイド線は `background-origin: border-box`。既定の `padding-box` だと `padding-left` ぶん
右へずれる。`background-size` の高さを `100%` にすることで、行が縦に積まれて 1 本に繋がる。

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

```typescript
// 箇条書きインデントの寸法。EditorView.baseTheme の "&" に置く CSS カスタムプロパティで、
// 見た目の深さを変えるときはここだけを触る（実装内に散らさない）
// --md-list-indent-base   2ch    0 段目にも入れる行頭の余白
// --md-list-indent-step   4ch    1 段あたりのインデント幅
// --md-list-bullet-width  1.4ch  "• " ぶんの見かけの幅
// --md-list-guide         var(--border)  縦ガイド線の色
// --md-list-guide-width   1px            縦ガイド線の太さ
// --md-list-guide-offset  0.5ch          弾丸の中心あたりへ線を寄せる量
```

## インターフェース

```typescript
// src/editor/live-preview.ts
/** onLinkClick: インラインリンク `[text](href)` のクリック時に href を渡して呼ぶ（BUG-012） */
export function livePreview(onLinkClick: (href: string) => void): Extension;

// 使用側（src/main.ts）— ノートの解決は editor 側に持たせず呼び出し元へ委ねる
mountEditor(el, {
  extraExtensions: [
    livePreview((href) => {
      if (/^https?:\/\//i.test(href)) return;   // 外部 URL は未対応
      void openNoteByName(href.replace(/^\.\//, ""));  // フォルダを捨てない（BUG-019）
    }),
  ],
});
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| @codemirror/view / state / language | Decoration・ViewPlugin・syntaxTree（core 導入済みの範囲内。追加依存なし） |
