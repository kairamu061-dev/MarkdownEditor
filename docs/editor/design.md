# editor 設計

サブ項目に分割済み。設計の詳細は各サブ項目を参照。

- [core](./core/design.md) — CodeMirror 6 エディタ本体、Nord テーマ、公開 API
- [live-preview](./live-preview/design.md) — 記法マークの表示/非表示（ライブプレビュー）
- [code-highlight](./code-highlight/design.md) — コードブロックの言語別ハイライト
- [wikilink](./wikilink/design.md) — `[[ノート名]]` リンク
- [inline-title](./inline-title/design.md) — エディタ最上部のノート名表示とインラインリネーム

## 横断事項

- CodeMirror 6 関連パッケージのバージョンは core / live-preview で共通管理（package.json）
- 色は `src/styles/nord.css` のエイリアスのみを参照する
- live-preview は core の公開する CodeMirror 拡張ポイント（`Extension` 配列）に追加する形で実装し、core 側のコードを変更しない
- **inline-title はこの例外**。CodeMirror の拡張ではなく `#main-content` の兄弟要素として置く。
  本文テキストに一切触れない（H1 見出しと連動しない）方針のため、エディタの状態管理から切り離している
- editor 配下は保管庫（vault）の知識を持たない。ファイル操作が必要な場合は
  コールバックとして受け取り、実処理は file-explorer 側に置く（wikilink / inline-title とも同じ）
