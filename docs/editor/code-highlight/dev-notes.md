# editor/code-highlight 開発メモ

## 実装上の判断

| 判断内容 | 理由 |
|----------|------|
| 言語パーサは @codemirror/language-data の遅延ロード | 起動時間・メモリへの影響を避ける（プロジェクトの省メモリ方針） |
| コードブロックの等幅・背景は Line Decoration で行単位に適用 | 下記の問題への対処。ブロック全体が背景色で塗られ Obsidian に近い見た目にもなる |

## 発生した問題と対処

| 問題 | 対処 |
|------|------|
| 言語指定フェンス内のコードが等幅にならず、フォント設定（セリフ体）がそのまま適用された | 言語トークンには markdown の monospace タグが付かないため、HighlightStyle の等幅指定が効かない。FencedCode / CodeBlock の行に `cm-codeblock-line` クラスを付与する code-block.ts を追加し、行単位で等幅+0.9em+背景を適用 |

## 設計からの変更点

| 変更内容 | 理由 |
|----------|------|
| code-block.ts（Line Decoration プラグイン）を追加。design.md は更新済み | 上記の等幅フォント問題。当初は「新規ファイルなし」の設計だった |

## 今後の課題

- 未知言語のフォールバック E2E（test-cases.md E-04。実装上はハイライトが付かないだけ）
- 言語エイリアスの網羅確認（language-data 準拠）

## ユーザへの要望

- Windows 11 実機での確認（test-cases.md E-05）
