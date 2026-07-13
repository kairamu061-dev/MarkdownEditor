# app-shell 開発メモ

## 実装上の判断

| 判断内容 | 理由 |
|----------|------|
| サブ項目に分割しない | spec.md の 4 機能はいずれも単独では検証不能（シェルが起動して初めて確認できる）かつ実装規模が極小で、統合の例外条件を満たす（2026-07-04 評価）。エディタ・ファイルツリーは当初から別フィーチャーエリア（`editor` / `file-explorer`）とする |
| UI フレームワーク不使用（素の TypeScript + DOM） | プロジェクト全体の省メモリ方針に従う |

## 発生した問題と対処

| 問題 | 対処 |
|------|------|
| devcontainer に Rust / Tauri の Linux 依存ライブラリが未導入だった | rustup で Rust stable を、apt で build-essential / libwebkit2gtk-4.1-dev / libgtk-3-dev / librsvg2-dev 等を導入（2026-07-04）。コンテナ再作成時に消えるため、恒久化するには .devcontainer/Dockerfile への追加が必要（ユーザへの要望参照） |
| バンドルターゲット（MSI/NSIS）は Windows 専用のため Linux でビルド不可 | Linux では `tauri build -- --no-bundle` でバイナリ生成までを検証。GUI 動作は Xvfb 上で起動・スクリーンショット・Ctrl+B 操作により確認（test-cases.md 参照） |
| 実機の手動確認のたびにビルド・起動手順を打つのが手間（ユーザー要望 2026-07-12） | `scripts/verify-build.bat` を追加。依存導入 → リリースビルド →（`run` 指定で）起動までを 1 コマンド化。第 2 引数で保管庫指定（MDE_VAULT）、`bundle` で MSI/NSIS 生成。.gitattributes が全体 LF 強制のままだと cmd がバッチを誤解釈するため `*.bat eol=crlf` を追加（BUG-001 の逆パターン） |
| リリースビルドが最終ステップ（`Building 444/446: markdown-editor`）で止まって見える（2026-07-13 実機報告） | 原因は Cargo.toml の `lto = true`（fat LTO）+ `codegen-units = 1`。最終クレートで全依存を単一スレッドで再最適化するため数分〜十数分かかり進捗バーも動かないが正常（サイズ最小化方針とのトレードオフ）。バッチにその旨の事前表示と、exe ロックによるリンク失敗を防ぐ起動中アプリの自動終了を追加。ビルド時間を優先するなら `lto = "thin"` への変更が選択肢（バイナリは微増） |

## 設計からの変更点

| 変更内容 | 理由 |
|----------|------|
| OS 標準タイトルバーを廃し、フレームレス＋自作タイトルバーへ（2026-07-12） | ユーザーフィードバック「ウィンドウバーがダサい」。Nord 配色に統一したミニマルな見た目に。☰ トグルもタイトルバーへ移設し、旧サイドバーヘッダ（「ファイル」表示・[+] ボタン）は撤去。設定 ⚙ はフッタのスイッチャ横へ |
| `dragDropEnabled: false` を追加（2026-07-12） | 既定（true）だと Tauri の OS ドロップ処理が WebView の HTML5 DnD を奪い、ノート/フォルダ移動が動作しなかった（BUG-005） |
| スクロールバーを Nord 配色のカスタムスタイルに統一（2026-07-13） | ユーザーフィードバック「スクロールバーの見た目が浮いている」。`::-webkit-scrollbar` をグローバル適用（幅 10px・トラック透明・丸角つまみ nord3・ホバー nord10）。色は nord.css に `--scrollbar-thumb` / `--scrollbar-thumb-hover` としてエイリアス追加。WebView2（Chromium）は対応、Linux の WebKitGTK はオーバーレイスクロールバーのため見た目確認は Windows 実機が必要 |

## 今後の課題

- サイドバー幅のドラッグリサイズと開閉状態の永続化は未対応（spec.md 未対応ケース参照）
- フレームレス化に伴うウィンドウ端リサイズの挙動を Windows 実機で確認（必要ならリサイズハンドル追加）

## ユーザへの要望

- Windows 11 実機での最終動作確認をお願いしたい（開発環境が Linux devcontainer のため Linux 上の検証まで）
- .devcontainer/Dockerfile に Rust ツールチェーンと Tauri の Linux 依存ライブラリを追加してコンテナを再ビルドすると、環境構築の再実行が不要になる（希望があれば Dockerfile の変更案を用意する）
