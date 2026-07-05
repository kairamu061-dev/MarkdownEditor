# editor 設計

サブ項目に分割済み。設計の詳細は各サブ項目を参照。

- [core](./core/design.md) — CodeMirror 6 エディタ本体、Nord テーマ、公開 API
- [live-preview](./live-preview/design.md) — 記法マークの表示/非表示（ライブプレビュー）
- [code-highlight](./code-highlight/design.md) — コードブロックの言語別ハイライト
- [wikilink](./wikilink/design.md) — `[[ノート名]]` リンク

## 横断事項

- CodeMirror 6 関連パッケージのバージョンは core / live-preview で共通管理（package.json）
- 色は `src/styles/nord.css` のエイリアスのみを参照する
- live-preview は core の公開する CodeMirror 拡張ポイント（`Extension` 配列）に追加する形で実装し、core 側のコードを変更しない
