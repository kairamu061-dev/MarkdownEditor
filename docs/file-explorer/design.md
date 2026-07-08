# file-explorer 設計

サブ項目に分割済み。設計の詳細は各サブ項目を参照。

- [vault](./vault/design.md) — Rust 側の保管庫状態管理とファイル I/O コマンド
- [tree-view](./tree-view/design.md) — サイドバーのファイルツリー UI とエディタ接続・保存
- [file-ops](./file-ops/design.md) — ノートの新規作成・リネーム・削除

## 横断事項

- フロントからのファイルアクセスは必ず vault のコマンドを経由する（fs 系プラグインは導入しない）
- パス表現はコマンド境界では「保管庫からの相対パス」で統一する（フロントに絶対パスを持たせない）
- tree-view / file-ops の UI 色は `nord.css` のエイリアスを参照する
