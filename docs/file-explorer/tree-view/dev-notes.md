# file-explorer/tree-view 開発メモ

## 実装上の判断

| 判断内容 | 理由 |
|----------|------|
| ツリーは全再描画方式 | 個人ヴォールト規模では十分軽く、差分更新の複雑さが見合わない。大規模化したら仮想化を検討 |
| ノード名は textContent で挿入 | ファイル名由来の文字列による HTML インジェクション防止 |
| 保存失敗時は pendingContent を保持 | 次の変更時に自動で再試行される（ユーザの編集内容を失わない） |
| スクラッチ文書（currentPath が null）は保存しない | 保存先が存在しないため。ヴォールトを開いてノートを選ぶまでは使い捨てメモ扱い |

## 発生した問題と対処

| 問題 | 対処 |
|------|------|
| E2E スクリプトでアプリのパスが解決できず exit 127 | 直前のコマンドの cd が残っていた。検証スクリプトは絶対パスを使うよう修正 |

## 設計からの変更点

| 変更内容 | 理由 |
|----------|------|
| index.ts に file-ops 向け公開フック（refreshTree / getCurrentPath / setCurrentPath / setContextMenuHandler）を追加 | file-ops の設計（file-ops/design.md）で必要になった接続点。tree-view 実装と同時に追加したため、file-ops の実装ファイルも tree-view のコミットに含まれている（検証と記録は file-ops 側で実施） |

## 今後の課題

- フォルダ展開状態の記憶、ツリーの手動リフレッシュ（spec 未対応ケース）
- pick_vault（ダイアログ経由）の E2E はヘッドレスでは未実施（test-cases.md E-05）

## ユーザへの要望

- Windows 11 実機での確認（test-cases.md E-05 / E-06）
