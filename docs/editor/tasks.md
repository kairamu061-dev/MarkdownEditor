# editor タスク

サブ項目に分割済み。タスクの詳細は各サブ項目を参照。

- [core](./core/tasks.md)
- [live-preview](./live-preview/tasks.md)
- [code-highlight](./code-highlight/tasks.md)
- [wikilink](./wikilink/tasks.md)
- [inline-title](./inline-title/tasks.md)
- [tabs](./tabs/tasks.md)

## 依存関係

- core → live-preview（live-preview は core のエディタ基盤の上に実装する）
- core → code-highlight / wikilink（いずれも core の拡張ポイントに追加する）
- wikilink のノートオープンは file-explorer/tree-view の公開フックを利用する
- inline-title は core に依存しない（CodeMirror の外側の DOM 要素）。
  表示追随とリネームで file-explorer の公開フックを利用する
- core → tabs（tabs は core の saveSession / restoreSession を使う）。
  開く・切り替え・追随の手順は file-explorer 側に置き、tabs はキーを不透明に扱う
