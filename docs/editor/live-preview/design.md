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
- 隠蔽は `Decoration.replace({})`、弾丸は `Decoration.replace({ widget: BulletWidget })`。
  弾丸は `-` に加えて**直後の空白 1 つ**まで置換し、ウィジェットの幅を
  `--md-list-bullet-width` に固定する（空白を残すとその幅がフォント依存になり、
  下のインデント計算が「だいたい合う」程度に落ちる。等幅フォントの `"• "` は 2ch ある）。
  カーソル判定はマーク 1 文字のままにしてある — 置換範囲の内側にあたる位置は
  マーク末尾だけで既に判定に含まれ、判定まで広げると Enter 直後のカーソル位置
  （本文先頭）で毎回 `- ` がソース表示に戻ってしまう
- 選択との重なり判定は仕様の「表示/再表示の判定ルール」に従い、記法ノードの親範囲
  （Emphasis / StrongEmphasis / InlineCode / Strikethrough / Link / 見出し行）と全選択レンジを比較する
- 弾丸の色は `EditorView.baseTheme` で `.cm-list-bullet { color: var(--accent) }` を定義

### リストのインデント

構文木の走査（ノード単位）とは別に、可視範囲を**行単位**で 1 周する 2 パス目を持つ。
1 行が複数の ListItem / BulletList に跨るため、ノード単位のままでは行デコレーションが重複する。

行ごとに `resolveInner(行頭の空白の直後)` から親を辿り、BulletList / OrderedList の数を
段数 d（0 始まり）とする。リストの中でなければ対象外。

寸法は 4 つのデコレーションで作る。単位は原文の空白幅に依存させない。

マーカーの幅は箇条書きと番号付きで求め方が違う。箇条書きはウィジェットに置換して
CSS で幅を決め切る。番号付きは**置換しない**（番号は生テキストのまま編集できる必要が
ある）ので、mark で幅だけを `文字数 × 1ch` に固定する。数字の字幅は多くのフォントで
`ch`（「0」の幅）と一致し、`.` と空白はそれより狭いため、箱は必ず中身より広くなる。
継続行は「その行が属する項目」のマーカー幅を使うので、本文の開始位置が揃う。

| 対象 | デコレーション | 与える値 |
|------|----------------|----------|
| 行頭の空白 | `Decoration.mark`（**replace ではない**） | `display:inline-block; width: d * step; text-indent: 0` |
| 番号付きマーク `1. ` | `Decoration.mark`（**replace ではない**） | `display:inline-block; width: 文字数 * 1ch; text-indent: 0; white-space: pre` |
| 行 | `Decoration.line` | `padding-left: base + d * step + markerWidth` |
| 行 | 同上 | `text-indent: -(行頭空白があれば d * step) - (マーク行なら markerWidth)` |
| 行 | 同上 | 段 1 以降は `background-image` に `linear-gradient` を d 本重ねて縦ガイド線 |

この組み合わせで

```
1 行目の左端      = padding - indent              = base + d * step        … マーカーの位置
1 行目の本文開始  = padding - indent + 空白 + マーク = base + d * step + markerWidth
折り返し行の左端  = padding                        = base + d * step + markerWidth
```

となり、本文と折り返しが**段数によらず**一致する。3 項とも CSS の長さ値だけで決まるので、
エディタのフォント設定を変えても比率は崩れない（マーカーの幅を固定してあるのが前提。上記参照）。

カーソルが乗って `- ` がソース表示に戻っている行だけは、`"- "` の実幅と
`--md-list-bullet-width` の差ぶん本文がずれる。これは整形表示とソース表示の
差そのもので、live-preview の他の記法と同じ性質。

**番号付きマーカーの箱には `white-space: pre` も要る。** カーソルが箱の末尾境界に来るため、
IME の変換中の文字をブラウザが箱の中のテキストノードへ継ぎ足す。幅が固定されているので
そのままだと**箱の中で折り返し**、未確定の文字が一行下に表示される（BUG-028）。
弾丸は置換なので同じ箱が無く、この問題は起きない。

**幅を固定する inline-block には必ず `text-indent: 0` を置くこと。** `text-indent` は継承
プロパティで、`inline-block` はブロックコンテナなので、行に掛けた負の `text-indent` を
中身にも適用してしまう。箱の位置は正しいのに中身だけが左へずれる（弾丸が段によらず
行頭に貼り付く）。

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
// リストインデントの寸法。EditorView.baseTheme の "&" に置く CSS カスタムプロパティで、
// 見た目の深さを変えるときはここだけを触る（実装内に散らさない）
// --md-list-indent-base   2ch    0 段目にも入れる行頭の余白
// --md-list-indent-step   4ch    1 段あたりのインデント幅
// --md-list-bullet-width  1.4ch  "• " ぶんの見かけの幅
// --md-list-marker-unit   1ch    番号付きマーク "1. " の 1 文字あたりの幅
// --md-list-guide         var(--border)  縦ガイド線の色
// --md-list-guide-width   1px            縦ガイド線の太さ
// --md-list-guide-offset  0.5ch          マーカーの中心あたりへ線を寄せる量
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

## Tab / Shift+Tab と番号の振り直し

既定の `indentMore` は `indentUnit`（2 スペース）を足すだけ。`- ` は 2 文字なので
箇条書きはたまたま入れ子になるが、**`1. ` は 3 文字なので 2 では入れ子にならない**。
構造が変わらないため番号も変わらず、「インデントしても番号が変わらない」ように見えていた
（BUG-026）。

字下げ量は隣接する項目の桁から決める。

| 操作 | 目標の桁 |
|------|----------|
| Tab | 直前の兄弟 ListItem の**本文が始まる桁**（マーク + 直後の空白ぶん） |
| Shift+Tab | 1 つ外側の ListItem の**マークが始まる桁** |

どちらも対象が無ければ（先頭項目・最上位項目）何もせずキーを消費する。
リスト項目の行でなければ既定の `indentMore` / `indentLess` に委譲する。

### 採番

- **入れ子のリストは常に 1 から。** 最上位のリストは先頭項目の番号を引き継ぐ
- 対象は「カーソルを含む最も外側のリスト」の範囲にある OrderedList すべて
- ListMark が無い・番号として読めない形に出会ったら、**そのリストは触らない**

### 1 トランザクションにまとめる

採番には字下げ**後**の構文木が要る。そこで `state.update()` で結果の状態だけを先に作り、
その状態で番号を計算し、2 つの ChangeSet を `compose` して 1 回だけ dispatch する。

分けて dispatch すると Ctrl+Z が 2 段になり、1 回目で「字下げは済んでいるが番号が古い」
という**まさに直したかった状態**が露出する。実測で確認したうえでこの形にした。

文書テキストを書き換える処理なので、`ensureSyntaxTree` が対象範囲を覆えなかった場合は
採番を行わない（字下げだけを適用する）。半端な木で番号を書き換えるとノートが壊れる。

## Enter キーの扱い

Enter は `Prec.highest` の 1 バインドにまとめ、次の順で試す。
どちらも `false` を返したら既定のキーマップへ渡る。

1. `quoteAwareEnter` — 行頭が `>` でない遅延継続行では plain な改行にする（BUG-011）
2. `lazyListEnter` — **リスト**の遅延継続行のうち、本文が項目の開始桁より左で終わって
   いるものを plain な改行にする（BUG-027）。lang-markdown の「空の項目か」の判定は
   `行のテキスト.slice(マークの桁)` で行うため、`- aaaa` の次行に `a` とだけ書くと
   `"a".slice(2)` が空になり、中身があるのに空項目と誤判定されて行の内容が消える。
   桁より右に本文がある通常の継続行は誤判定しないので、そちらは委譲する
3. `insertNewlineContinueMarkupCommand({ nonTightLists: false })` — 空の箇条書き項目で
   Enter を押したとき、マークを消さず「上に空行を挿入して loose 化する」lang-markdown の
   既定分岐を止める（BUG-025）。この分岐は**タイトな 2 項目リストの 2 番目**でだけ起きる

`markdown()` は Enter を `Prec.high` で束ねるため、`Prec.highest` でないと先に取れない。

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| @codemirror/view / state / language | Decoration・ViewPlugin・syntaxTree（core 導入済みの範囲内。追加依存なし） |
