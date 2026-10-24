@echo off
setlocal
chcp 65001 >nul

rem === 手動確認用ビルドバッチ（Windows 11） =============================
rem 使い方（リポジトリのどこからでも実行可）:
rem   scripts\verify-build.bat                リリース exe をビルドするだけ
rem   scripts\verify-build.bat run           ビルド後にそのまま起動
rem   scripts\verify-build.bat run D:\vault  指定した保管庫を開いて起動
rem   scripts\verify-build.bat bundle        MSI / NSIS インストーラまで作成
rem
rem チェックリスト: tmp\動作確認\動作確認チェックリスト.md
rem =====================================================================

cd /d "%~dp0.."

where npm >nul 2>nul
if errorlevel 1 (
  echo [NG] npm が見つかりません。Node.js をインストールしてください。
  exit /b 1
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo [NG] cargo が見つかりません。Rust ^(rustup^) をインストールしてください。
  exit /b 1
)

rem 起動中のアプリが exe をロックしているとリンクに失敗するため先に終了する
tasklist /fi "imagename eq MarkdownEditor.exe" 2>nul | find /i "MarkdownEditor.exe" >nul && (
  echo 起動中の MarkdownEditor を終了します（編集内容は自動保存済みのはずです）
  taskkill /f /im MarkdownEditor.exe >nul 2>nul
)
tasklist /fi "imagename eq markdown-editor.exe" 2>nul | find /i "markdown-editor.exe" >nul && (
  taskkill /f /im markdown-editor.exe >nul 2>nul
)

rem node_modules の有無だけでは不十分。Linux 側（devcontainer）で導入されたツリーが
rem 残っていると .cmd シムもネイティブバイナリ（tauri / rollup / esbuild の win32 版）も
rem 無く、npm run tauri が「コマンドが見つかりません」で落ちる（BUG-023）。
rem Windows 用インストールでのみ作られる .cmd シムをマーカーに判定する。
if not exist "node_modules\.bin\tauri.cmd" (
  if exist node_modules (
    echo === node_modules が Windows 用ではないため導入し直します ===
    echo     ※他 OS 側で導入されたツリーが残っています。数分かかります。
  ) else (
    echo === 依存パッケージを導入します（初回のみ） ===
  )
  rem npm install だとロックファイル充足済みと判断され win32 向け optional dependency を
  rem 確実に補完しないため、node_modules を作り直す npm ci を使う。
  call npm ci
  if errorlevel 1 (
    echo [NG] 依存パッケージの導入に失敗しました。
    exit /b 1
  )
)

rem exe にビルド機のユーザーフォルダ（例: C:\Users\<名前>\.cargo\registry\...）を残さない。
rem Rust は依存クレートのソースの場所をパニック時の表示用に埋め込むため、そのままだと
rem 配布するインストーラにユーザー名が入る。ビルド時にその部分を ~ へ置き換える。
rem RUSTFLAGS は空白で区切られるので、空白を含むパスでは置き換えを諦めて警告だけ出す。
rem
rem 括弧のブロックや if の入れ子にはしないこと。cmd は if を評価する前に行（ブロック全体）の
rem %%...%% を展開するので、未定義の変数の %%VAR: =%% は空にならず構文が壊れる（BUG-037。
rem CARGO_HOME 未定義で「( was unexpected at this time.」）。パスに ) を含む場合も
rem ブロックが途中で閉じる。goto で 1 行ずつ判定する。
if not "%USERPROFILE: =%"=="%USERPROFILE%" goto :profile_has_space
set "RUSTFLAGS=%RUSTFLAGS% --remap-path-prefix=%USERPROFILE%=~"
goto :profile_done
:profile_has_space
echo [注意] ユーザーフォルダのパスに空白があるため、exe からのパス除去を行いません: %USERPROFILE%
:profile_done
rem CARGO_HOME が未定義なら次の行は読まれない（未定義のまま %%CARGO_HOME: =%% を展開させない）
if not defined CARGO_HOME goto :cargo_home_done
if not "%CARGO_HOME: =%"=="%CARGO_HOME%" goto :cargo_home_done
set "RUSTFLAGS=%RUSTFLAGS% --remap-path-prefix=%CARGO_HOME%=cargo-home"
:cargo_home_done

echo.
echo ※最後の「Building ... markdown-editor」は LTO 最適化のため数分〜十数分
echo   止まって見えますが正常です。rustc が CPU を使っていればそのまま待ってください。
echo.

if /i "%~1"=="bundle" (
  echo === リリースビルド（MSI / NSIS 付き） ===
  call npm run tauri build
) else (
  echo === リリースビルド（exe のみ） ===
  call npm run tauri build -- --no-bundle
)
if errorlevel 1 (
  echo [NG] ビルドに失敗しました。上のエラーを確認してください。
  exit /b 1
)

set "EXE=src-tauri\target\release\MarkdownEditor.exe"
if not exist "%EXE%" set "EXE=src-tauri\target\release\markdown-editor.exe"
if not exist "%EXE%" (
  echo [NG] ビルド後の exe が見つかりません: src-tauri\target\release\
  exit /b 1
)

rem 置き換えが効いたかを確かめる（ユーザーフォルダのパスが exe に残っていないか）
findstr /l /m /c:"%USERPROFILE%" "%EXE%" >nul 2>nul || goto :path_check_done
echo [注意] exe にユーザーフォルダのパスが残っています: %USERPROFILE%
echo        配布する場合は RUSTFLAGS の --remap-path-prefix を確認してください。
:path_check_done

echo.
echo [OK] ビルド完了: %EXE%
for %%F in ("%EXE%") do echo      更新日時: %%~tF
git rev-parse --short HEAD >nul 2>nul && for /f %%H in ('git rev-parse --short HEAD') do echo      コミット: %%H
if /i "%~1"=="bundle" echo      インストーラ: src-tauri\target\release\bundle\

if /i not "%~1"=="run" goto :done

if not "%~2"=="" set "MDE_VAULT=%~2"
echo.
echo === 起動します ===
start "" "%EXE%"

:done
endlocal
