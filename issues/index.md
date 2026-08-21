# バグチケット一覧

## ステート凡例

| ステート | 説明 |
|---------|------|
| Open | 未着手 |
| In Progress | 対応中 |
| Fixed | 修正済み（未検証） |
| Closed | 修正確認済み |

---

## チケット一覧

| ID | タイトル | タグ | ステート |
|----|---------|------|---------|
| [BUG-001](./tickets/BUG-001.md) | add-feature.sh が CRLF 改行のため Linux で実行不能 | tooling | Closed |
| [BUG-002](./tickets/BUG-002.md) | ノートを開くと畳んでいたフォルダがすべて開いてしまう | tree-view | Closed |
| [BUG-003](./tickets/BUG-003.md) | 保管庫スイッチャの一覧がフォルダ名でなくフルパス表示 | vault-switch | Closed |
| [BUG-004](./tickets/BUG-004.md) | ツリー空白部の右クリックで WebView2 既定メニューが出る | tree-view | Closed |
| [BUG-005](./tickets/BUG-005.md) | ドラッグ&ドロップによる移動が全く動作しない | tree-view | Closed |
| [BUG-006](./tickets/BUG-006.md) | redo（Ctrl+Y）が動作しない | editor/core | Closed |
| [BUG-007](./tickets/BUG-007.md) | サイドバー開閉トグル（☰ ボタン）が効かない | app-shell | Closed |
| [BUG-008](./tickets/BUG-008.md) | 引用文（`>`）内での Backspace / 入力が誤動作する | editor/core | Closed |
| [BUG-009](./tickets/BUG-009.md) | 箇条書きの深いネストが視覚的に判別しにくい / Tab 連打後 Enter で最上位に戻る | editor/live-preview | Closed |
| [BUG-010](./tickets/BUG-010.md) | 引用行の改行→Backspace の直後に日本語 IME 変換確定すると文字化けする | editor/core | Closed |
| [BUG-011](./tickets/BUG-011.md) | `>` を消した引用の遅延継続行が引用として振る舞う（斜体が残る・Enter で `> ` が復活） | editor/live-preview | Closed |
| [BUG-012](./tickets/BUG-012.md) | インラインリンク `[text](url)` をクリックしてもノートへ遷移しない | editor/live-preview | Closed |
| [BUG-013](./tickets/BUG-013.md) | フォルダをリネームすると配下で開いているノートが保存できなくなる | file-explorer/file-ops | Closed |
| [BUG-014](./tickets/BUG-014.md) | 保存失敗中のノート切替で失敗内容が別ノートを誤上書きしうる | file-explorer | Closed |
| [BUG-015](./tickets/BUG-015.md) | ウィキリンク `[[note.md]]`・`[[sub/note]]` が開けない | file-explorer | Closed |
| [BUG-016](./tickets/BUG-016.md) | リネーム入力の blur で入力名が黙って破棄される | file-explorer/file-ops | Closed |
| [BUG-017](./tickets/BUG-017.md) | ウィンドウを閉じると最大 700ms 分の編集が保存されず消える | app-shell | Closed |
| [BUG-018](./tickets/BUG-018.md) | テーブル装飾がカーソル移動のたびに全文書を再走査する | editor/live-preview | Closed |
| [BUG-019](./tickets/BUG-019.md) | インラインリンクだけサブフォルダ指定が効かない | editor/live-preview | Closed |
| [BUG-020](./tickets/BUG-020.md) | `settings.json` の書き込みが非アトミックで設定が消えうる | file-explorer | Closed |
| [BUG-021](./tickets/BUG-021.md) | シンボリックリンクで無限再帰クラッシュ / 保管庫外アクセス | file-explorer | Closed |
| [BUG-022](./tickets/BUG-022.md) | ドロップ先ハイライトのちらつき / ステータス通知が再描画で消える | file-explorer/tree-view | Closed |
| [BUG-023](./tickets/BUG-023.md) | verify-build.bat が Linux 側の node_modules を再利用してビルド不能 | tooling | Closed |
| [BUG-024](./tickets/BUG-024.md) | アイコンを差し替えても exe のアイコンが更新されない | tooling | Closed |
| [BUG-025](./tickets/BUG-025.md) | 2 項目のリストで空項目の Enter がマークを消さず上に空行を挿入する | editor/live-preview | Closed |
| [BUG-026](./tickets/BUG-026.md) | 番号付きリストで Tab が入れ子にならず、番号も振り直されない | editor/live-preview | Closed |
| [BUG-027](./tickets/BUG-027.md) | リストの遅延継続行で Enter を押すと入力した文字が消える | editor/live-preview | Closed |
| [BUG-028](./tickets/BUG-028.md) | 番号付きリストの IME 変換中の文字が一行下に出る | editor/live-preview | Closed |
| [BUG-029](./tickets/BUG-029.md) | リストの遅延継続行が項目の本文位置まで字下げされる | editor/live-preview | Closed |
| [BUG-030](./tickets/BUG-030.md) | インデントされたリスト行でカーソルが大きく飛ぶ | editor/live-preview | Closed |
| [BUG-031](./tickets/BUG-031.md) | 空のリスト項目を Backspace で消すと空白だけの行が残る | editor/live-preview | Closed |
| [BUG-032](./tickets/BUG-032.md) | 番号付きリストで番号と本文のあいだに余分な隙間が空く | editor/live-preview | Closed |
| [BUG-033](./tickets/BUG-033.md) | コードブロックの中でテキストを選択しても反転して見えない | editor/code-highlight | Open |
