# editor/core 開発メモ

## 実装上の判断

| 判断内容 | 理由 |
|----------|------|
| `basicSetup` を使わず拡張を個別選択 | 行番号ガター・折りたたみ等の不要機能を外し、Obsidian ライクな見た目と軽さを両立 |
| GFM 有効化は `markdown({ base: markdownLanguage })` で指定 | `markdown()` のデフォルトは CommonMark のみで、打ち消し等の GFM 記法が効かないため |
| `-` 1 文字の下線見出しを無効にした（2026-10-24・BUG-035） | 「文章の下の行に `-` を入れると上の文章が見出し 2 になる」との報告。CommonMark の setext 見出しで、下線は 1 文字でもよい。文章の下に箇条書きを書くたびに `-` を打った瞬間だけ見出しになり、`- ` まで打っても戻らない（空の項目は段落を中断できないので下線の解釈が勝つ）。ユーザーに「`-` 1 文字だけ無効 / 下線見出しを全部無効 / 規則どおり」を示し、`-` 1 文字だけ無効を選んでもらった。他のツールではこの 2 行が見出しに見える食い違いは承知の上。`--` `---` `===` は意図して書く下線なので残す。実装は SetextHeading の差し替えではなくインスタンスの包み込み（design.md 参照。置き換えると段落直下の `---` が水平線に化ける） |
| リストマークの色は core では記法マークと同色 | ListMark のハイライトタグが他マークと共通（processingInstruction）で個別着色にはパーサ拡張が必要。アクセント色の弾丸は live-preview の • 置換で実現する方が単純（spec.md を修正済み） |
| テーマの色指定は CSS カスタムプロパティ経由 | nord.css を唯一の色定義元に保つ（プロジェクト方針） |

## 発生した問題と対処

| 問題 | 対処 |
|------|------|
| Vite が 500kB 超のチャンク警告を出す | CodeMirror 本体のサイズによるもの。資産はバイナリ埋め込みでローカル読み込みのため実害なし。対処不要と判断 |
| BUG-010（引用+Backspace 直後の IME 確定で文字化け） | `@codemirror/view` 6.43.6 / `@codemirror/state` 6.7.1 への更新（`a8326d2`）で 2026-07-22 実機再現せず。**機序は未特定のため、この 2 パッケージのバージョンを安易に戻さないこと**（ダウングレードで再発リスク）。詳細は `issues/tickets/BUG-010.md` |

## 設計からの変更点

| 変更内容 | 理由 |
|----------|------|
| theme.ts の .cm-scroller を CSS 変数参照に変更（--editor-font-family / --editor-font-size、フォールバック付き） | settings/ui のフォント設定に対応するため（2026-07-05）。未設定時の見た目は従来どおり |
| 見出し色を h1=gold(--warning/nord13)、h2=accent(nord8)、h3-h6=accent-secondary(nord9) の 3 段階に変更（2026-07-13） | 全レベル同色（nord9）では「地味すぎる」との実機フィードバック。サイズ差に加え色の段差で視覚的なヒエラルキーを強調。aurora 色は h1 のみ（金色）に限定し全体配色との調和を保つ |
| 見出し色を h2=success(nord14,green)・h3=nord15(mauve)・h4=accent(nord8,cyan) に再変更（2026-07-13） | h2（nord8, cyan）と h3-h6（nord9, muted blue）が Nord 暗背景（#2e3440）に溶け込むとの追加フィードバック。同系色の青/シアン系を aurora 系色（緑・紫）に置き換え gold→green→mauve→blue の階層を形成する |
| processingInstruction タグ色を --border(nord3) → --syntax-mark(nord10) に変更（2026-07-13） | `#` 見出しマーク（HeaderMark）と `\|` テーブル区切り（TableDelimiter）が暗い背景に溶け込んで見えないとの実機フィードバック。nord10（#5e81ac）はコントラスト比 3.6:1 で可読だが本文より沈んだ落ち着きを保つ。同タグが両マーク共通なので一括変更 |
| HighlightStyle に t.heading（基底）ルールを追加（2026-07-13） | GFM テーブルのヘッダーセル（TableHeader）が tags.heading 基底タグでタグ付けされるが h1-h6 ルールは heading1-6 サブタグにしか一致しないため、テーブルヘッダーが平文扱いになっていた。t.heading 基底ルール追加で bold + accent-secondary 色が当たる。h1-h6 は特化タグが優先するため既存の配色は変わらない |

## 今後の課題

- コードブロックの言語別ハイライト（@codemirror/language-data の遅延読み込みで対応予定）
- スクラッチ文書は保存されない旨の UI 表示がない（file-explorer でファイル接続後に解消）

## ユーザへの要望

- Windows 11 実機での動作確認（test-cases.md E-04）
