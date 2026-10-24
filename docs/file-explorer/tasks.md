# file-explorer タスク

サブ項目に分割済み。タスクの詳細は各サブ項目を参照。

- [vault](./vault/tasks.md)
- [tree-view](./tree-view/tasks.md)
- [file-ops](./file-ops/tasks.md)
- [vault-switch](./vault-switch/tasks.md)
- [multi-select](./multi-select/tasks.md)

## 依存関係

- vault → tree-view → file-ops（file-ops はツリーとメニュー UI を前提とする）
- tree-view → multi-select（ツリー描画と DnD のドロップ先を前提とする）
- vault → vault-switch（保管庫を開くコマンドと `recentVaults`（settings/store）を前提とする）
