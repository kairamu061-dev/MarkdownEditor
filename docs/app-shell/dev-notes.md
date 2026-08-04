# app-shell 開発メモ

## 実装上の判断

| 判断内容 | 理由 |
|----------|------|
| サブ項目に分割しない | spec.md の 4 機能はいずれも単独では検証不能（シェルが起動して初めて確認できる）かつ実装規模が極小で、統合の例外条件を満たす（2026-07-04 評価）。エディタ・ファイルツリーは当初から別フィーチャーエリア（`editor` / `file-explorer`）とする |
| UI フレームワーク不使用（素の TypeScript + DOM） | プロジェクト全体の省メモリ方針に従う |
| アプリアイコンに羽根ペン（Nord cyan 配色）を採用（2026-08-04） | 候補 5 案（cyan / violet / emerald / amber / monochrome）から選定。採用案は背景 `#2E3643`・羽根 `#88C2CD` で、アプリ本体が使用する Nord パレットの nord0 `#2E3440` / nord8 `#88C0D0` とほぼ一致するため、アイコンと UI の配色が連続する。羽根ペン＝執筆のメタファもエディタの用途に合う |
| アイコン原画（1024px）を `assets/icon-source-1024.png` として追跡下に置く | 生成元は `tmp/` にあったが同ディレクトリは .gitignore 対象で、そのままではアイコンセットを再生成できなくなるため。`tauri icon` はこの追跡パスから実行する |
| `src-tauri/icons/` の iOS / Android サブディレクトリは削除 | `tauri icon` が全プラットフォーム分を生成するが、本プロジェクトのバンドルターゲットは `msi` / `nsis`（デスクトップのみ）でモバイル用は未使用のため |

## 発生した問題と対処

| 問題 | 対処 |
|------|------|
| devcontainer に Rust / Tauri の Linux 依存ライブラリが未導入だった | rustup で Rust stable を、apt で build-essential / libwebkit2gtk-4.1-dev / libgtk-3-dev / librsvg2-dev 等を導入（2026-07-04）。コンテナ再作成時に消えるため、恒久化するには .devcontainer/Dockerfile への追加が必要（ユーザへの要望参照） |
| バンドルターゲット（MSI/NSIS）は Windows 専用のため Linux でビルド不可 | Linux では `tauri build -- --no-bundle` でバイナリ生成までを検証。GUI 動作は Xvfb 上で起動・スクリーンショット・Ctrl+B 操作により確認（test-cases.md 参照） |
| 実機の手動確認のたびにビルド・起動手順を打つのが手間（ユーザー要望 2026-07-12） | `scripts/verify-build.bat` を追加。依存導入 → リリースビルド →（`run` 指定で）起動までを 1 コマンド化。第 2 引数で保管庫指定（MDE_VAULT）、`bundle` で MSI/NSIS 生成。.gitattributes が全体 LF 強制のままだと cmd がバッチを誤解釈するため `*.bat eol=crlf` を追加（BUG-001 の逆パターン） |
| Windows で `verify-build.bat` が `'tauri' is not recognized` で失敗（2026-08-04 実機報告 / BUG-023） | 依存導入ガードが `node_modules` の存在だけを見ており、Linux 側で導入されたツリーを「導入済み」と誤判定していた。Linux 用ツリーには `.cmd` シムも win32 版ネイティブバイナリ（tauri / rollup / esbuild）も無く、`beforeBuildCommand` の `tsc && vite build` も含めて Windows では動かない。ガードを `node_modules\.bin\tauri.cmd` の有無に変更し、欠けていれば `npm ci` で導入し直す（`npm install` はロックファイル充足済みと判断して optional dependency を確実に補完しないため） |
| リリースビルドが最終ステップ（`Building 444/446: markdown-editor`）で止まって見える（2026-07-13 実機報告） | 原因は Cargo.toml の `lto = true`（fat LTO）+ `codegen-units = 1`。最終クレートで全依存を単一スレッドで再最適化するため数分〜十数分かかり進捗バーも動かないが正常（サイズ最小化方針とのトレードオフ）。バッチにその旨の事前表示と、exe ロックによるリンク失敗を防ぐ起動中アプリの自動終了を追加。ビルド時間を優先するなら `lto = "thin"` への変更が選択肢（バイナリは微増） |

## 設計からの変更点

| 変更内容 | 理由 |
|----------|------|
| OS 標準タイトルバーを廃し、フレームレス＋自作タイトルバーへ（2026-07-12） | ユーザーフィードバック「ウィンドウバーがダサい」。Nord 配色に統一したミニマルな見た目に。☰ トグルもタイトルバーへ移設し、旧サイドバーヘッダ（「ファイル」表示・[+] ボタン）は撤去。設定 ⚙ はフッタのスイッチャ横へ |
| `dragDropEnabled: false` を追加（2026-07-12） | 既定（true）だと Tauri の OS ドロップ処理が WebView の HTML5 DnD を奪い、ノート/フォルダ移動が動作しなかった（BUG-005） |
| スクロールバーを Nord 配色のカスタムスタイルに統一（2026-07-13） | ユーザーフィードバック「スクロールバーの見た目が浮いている」。`::-webkit-scrollbar` をグローバル適用（幅 14px・トラック透明・丸角つまみ nord3・ホバー nord10）。色は nord.css に `--scrollbar-thumb` / `--scrollbar-thumb-hover` としてエイリアス追加。当初 10px で実装したが「もう少し太くていい」との追加フィードバックで 14px に変更（2026-07-13）。WebView2（Chromium）は対応、Linux の WebKitGTK はオーバーレイスクロールバーのため見た目確認は Windows 実機が必要 |

## 今後の課題

- サイドバー幅のドラッグリサイズと開閉状態の永続化は未対応（spec.md 未対応ケース参照）
- アイコン 16px（ICO 内の最小サイズ）では羽根の軸線がほぼ潰れる。単純縮小のため避けられず、必要なら 16/32px だけ軸を太くした専用ビットマップを差し込む（マルチ解像度 ICO の常套手段）。32px 以上は軸線・羽先とも判別可能で実用上の問題はない
- 作業ツリーを Windows と Linux で共有している場合、1 つの `node_modules` が両方の OS を同時に満たすことはできない（ネイティブバイナリがプラットフォーム固有のため）。Windows でビルドした後に devcontainer 側で node ツールを動かすときは Linux 側で `npm ci` をやり直す、逆もまた同様、という運用上の制約がある。ツリーを 2 つに分ける仕組みは導入しない
- 採用アイコンは角丸の四角形が絵柄に焼き込まれているため、macOS 配布時は OS 標準のアイコン余白（インセット）が付かず全面表示になる。現状のターゲットは Windows のみのため実害なし
- フレームレス化に伴うウィンドウ端リサイズの挙動を Windows 実機で確認（必要ならリサイズハンドル追加）

## ユーザへの要望

- Windows 11 実機での最終動作確認をお願いしたい（開発環境が Linux devcontainer のため Linux 上の検証まで）
- .devcontainer/Dockerfile に Rust ツールチェーンと Tauri の Linux 依存ライブラリを追加してコンテナを再ビルドすると、環境構築の再実行が不要になる（希望があれば Dockerfile の変更案を用意する）
