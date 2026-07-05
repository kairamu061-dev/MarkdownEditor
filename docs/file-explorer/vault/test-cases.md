# file-explorer/vault テストケース

## ユニットテスト

| ID | テスト名 | 入力 / 条件 | 期待結果 | ステータス |
|----|---------|------------|---------|-----------|
| U-01 | resolve_accepts_nested_relative_path | `a/b.md` | ルート配下に解決される | [x] |
| U-02 | resolve_rejects_parent_traversal | `../escape.md`, `a/../../escape.md` | エラー | [x] |
| U-03 | resolve_rejects_absolute_path | `/etc/passwd` | エラー | [x] |
| U-04 | ensure_md_checks_extension | `.md` / `.MD` / `.txt` / 拡張子なし | md のみ許可 | [x] |
| U-05 | build_tree_sorts_and_filters | 混在ディレクトリ | フォルダ先行・名前順・隠し/非md除外・子パスが相対 | [x] |

## インテグレーションテスト

| ID | テスト名 | 前提条件 | 手順 | 期待結果 | ステータス |
|----|---------|---------|------|---------|-----------|
| I-01 | コマンド経由の読み書き | tree-view 実装済み | tree-view の E2E で担保 | ノートの開閉・保存が機能 | [ ] |

## E2Eテスト

（UI なし。tree-view / file-ops の E2E で担保する）

## ステータス凡例

- `[ ]` 未実施
- `[~]` 実施中
- `[x]` 合格
- `[!]` 不合格

---

実施記録: U-01〜U-05 は 2026-07-05 に `cargo test` で実施し合格（5 passed）。
