# settings タスク

サブ項目に分割済み。タスクの詳細は各サブ項目を参照。

- [store](./store/tasks.md)
- [vault-restore](./vault-restore/tasks.md)
- [ui](./ui/tasks.md)
- [theme](./theme/tasks.md)
- [theme-io](./theme-io/tasks.md)

## 依存関係

- store → vault-restore / ui / theme / theme-io（いずれも store のコマンド・ヘルパを使う）
- ui → theme（配色セクションは ui の設定モーダルの中に作る）
- theme → theme-io（テーマファイルは theme の 23 項目と検証器を土台にする）
