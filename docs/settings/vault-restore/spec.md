# settings/vault-restore 仕様

## 機能一覧

| # | 機能名 | 説明 |
|---|--------|------|
| 1 | lastVault の記録 | pick_vault / initial_vault でヴォールトが開かれるたびに settings.json の lastVault を更新 |
| 2 | 起動時の復元 | initial_vault の解決順を 起動引数 > MDE_VAULT > lastVault に拡張 |

## 起動時の解決ルール

1. 起動引数の 1 番目が存在するディレクトリならそれを開く
2. 次に環境変数 `MDE_VAULT` が存在するディレクトリならそれを開く
3. 次に settings.json の lastVault が存在するディレクトリならそれを開く
4. いずれもなければ未オープン状態（「ヴォールトを開く」ボタン）

- 1・2 で開いた場合も lastVault を更新する（次回は引数なしで同じ場所が開く）

## エラーケース

| 条件 | 挙動 |
|------|------|
| lastVault のフォルダが存在しない | 未オープン状態で起動（lastVault は書き換えない。フォルダが戻れば次回復元される） |
| settings.json への保存失敗 | ヴォールトは正常に開く。ログ出力のみ |

## 未対応ケース

- ヴォールト履歴（直近 1 件のみ）
- lastVault の手動クリア UI
