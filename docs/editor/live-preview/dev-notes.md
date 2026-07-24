# editor/live-preview 開発メモ

## 実装上の判断

| 判断内容 | 理由 |
|----------|------|
| 表示切り替えを Decoration.replace のみで実装（文書は不変更） | undo 履歴や保存内容に影響を与えないため。CodeMirror の標準機構で軽量 |
| 走査対象を view.visibleRanges に限定 | 大きな文書でも選択移動のたびの再計算を軽く保つ（省メモリ・軽快さ方針） |
| 引用の装飾判定は Blockquote ノードではなく QuoteMark 単位 | 2026-07-24 のフィードバック「行頭が `>` でない行は引用扱いしたくない」への対応。CommonMark の遅延継続（lazy continuation）では `>` の無い行も `Blockquote` ノードに含まれるため、ノード単位で装飾すると `>` を消した行まで引用のままになる。実際に `>` がある行だけに `QuoteMark` が付く（パーサで確認）ので、QuoteMark を基準にすれば「行頭が `>` の行」だけを引用にできる |
| 引用マーク `>` は隠す（ただしカーソルのある行はソース表示） | 2026-07-24 のフィードバック「`>` の見た目を消したい」への対応。他の記法マークと同じく `touchesSelection`（行単位）で、カーソルがその行にある間だけ `>`（＋直後の空白）をソース表示し、それ以外は replace で隠す。BUG-010（`deleteMarkupBackward`＋IME）は依存更新（`a8326d2`）で解消済み。かつ hide されるのは非アクティブ行のみ（編集中の行の `>` は表示）なので、編集・IME 中の行に replace 装飾は載らない |

## 発生した問題と対処

| 問題 | 対処 |
|------|------|
| （なし） | |

## 設計からの変更点

| 変更内容 | 理由 |
|----------|------|
| （なし — 設計どおり） | |

## 設計からの変更点

| 変更内容 | 理由 |
|----------|------|
| テーブルレンダリングを `table-preview.ts` として live-preview.ts から分離して追加（2026-07-13） | GFM テーブルがソーステキスト表示のまま「記法が動作していない」とのユーザーフィードバック。シンタックスハイライト（`\|` の色変更）のみでは視覚的なテーブル構造が伝わらないため、Obsidian 同様に `<table>` ウィジェットに置換するアプローチを選択。実装は `Decoration.replace({ block: true, widget })` でテーブルノード全体を置換し、カーソルがテーブル範囲に入ると widget が外れてソース表示に戻る |
| インラインリンク `[text](url)` クリックでノートへ移動（2026-07-13） | `live-preview.ts` の Link ノード処理で `LinkText` 範囲に `data-href` 属性を付与し `mousedown` ハンドラで `openNoteByName` を呼ぶ。外部 URL（http/https）はスキップ。パスにディレクトリが含まれる場合はファイル名のみを抽出してファイル名検索にフォールバックする |
| テーブルセル内のインライン Markdown を HTML としてレンダリング（2026-07-13） | `textContent` では `**太字**` や `[リンク]()` がそのまま表示されていた。`renderInline()` 関数でコードスパン保護 → HTMLエスケープ → 太字/斜体/打消し/リンク変換 → コードスパン復元 の順で処理し `innerHTML` に代入。XSS 対策として生テキストは `escapeHtml()` 済みの上で span/code 要素のみ挿入する |
| 引用ブロックに左バー＋背景＋本文色を追加（2026-07-22） | 「引用の見た目が italic だけで引用っぽくない」との実機フィードバック。`Blockquote` ノードの各行に `Decoration.line({ class: "cm-blockquote" })` を付与し、CSS で `border-left`（`--quote-bar`）・淡い背景（`--quote-bg`）・落ち着いた本文色（`--quote-text`）を当てる。色は nord.css に 3 エイリアスを追加（唯一の色定義元を維持）。ネスト引用は複数ノードが同じ行を跨ぐため行頭位置の Set で重複付与を防ぐ |
| 引用の判定基準を Blockquote → QuoteMark に変更＋`>` マークを隠す（2026-07-24） | フィードバック 2 件への対応。①「`>` の見た目を消したい」→ `QuoteMark`（＋直後の空白）を `touchesSelection`（行単位）で条件付き replace 隠蔽（カーソルのある行だけソース表示）。②「行頭が `>` でない行を引用扱いしたくない」→ 装飾の起点を `Blockquote` ノードの行走査から `QuoteMark` ノードに変更。遅延継続で `>` の無い行が Blockquote に含まれても QuoteMark が無いので装飾されない。line decoration も QuoteMark のある行にのみ付与 |

## 今後の課題

- 画像レンダリング、コードブロックフェンスの隠蔽（spec.md 未対応ケース参照）
- リンクの Ctrl+クリックで外部ブラウザを開く（Tauri の opener プラグインが必要）

## ユーザへの要望

- Windows 11 実機での動作確認（test-cases.md E-05）

## Windows ビルド時の注意（2026-07-17）

devcontainer（Linux）で `npm install` を実行すると `node_modules` に Linux 用バインディングが入る。
Windows 実機でビルドする際は `node_modules` を削除してから `npm install` を再実行すること。
`package-lock.json` 自体は win32 エントリを含むため削除不要。

```powershell
rd /s /q node_modules
npm install
npm run tauri build --no-bundle
```
