# editor テストケース

editor は複数のサブ項目に分割されており、テストケースは各サブ項目の test-cases.md で管理する。
本エリア固有の横断的テストはなく、以下のサブ項目のケースで全体を担保する。

| サブ項目 | test-cases | 状態 |
|----------|-----------|------|
| core | [editor/core/test-cases.md](./core/test-cases.md) | 全合格（2026-07-20 実機で E-07 見出し配色・E-08 引用 Backspace 確認） |
| live-preview | [editor/live-preview/test-cases.md](./live-preview/test-cases.md) | 全合格（E-01〜E-15、〜2026-07-27 実機）。E-08 インラインリンク遷移・E-15 引用 Enter は BUG-012/BUG-011 修正後に Windows 実機で確認済み |
| code-highlight | [editor/code-highlight/test-cases.md](./code-highlight/test-cases.md) | 全合格 |
| wikilink | [editor/wikilink/test-cases.md](./wikilink/test-cases.md) | 全合格 |

## ステータス凡例

- `[ ]` 未実施
- `[~]` 実施中
- `[x]` 合格
- `[!]` 不合格
