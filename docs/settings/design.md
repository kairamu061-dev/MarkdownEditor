# settings 設計

サブ項目に分割済み。設計の詳細は各サブ項目を参照。

- [store](./store/design.md) — settings.json の読み書き基盤（Rust）
- [vault-restore](./vault-restore/design.md) — ヴォールトの記憶と起動時復元
- [ui](./ui/design.md) — 設定モーダルとフォント反映

## 横断事項

- 設定スキーマは store の `Settings` 構造体を唯一の定義とし、フロントは同型の TypeScript interface を持つ
- 設定は「読み込みは起動時 1 回・保存は変更時」のシンプルな運用（ファイルウォッチはしない）
- vault-restore は vault コマンド（file-explorer/vault）の内部に統合し、フロントの変更を伴わない
