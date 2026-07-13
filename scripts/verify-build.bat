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

if not exist node_modules (
  echo === 依存パッケージを導入します（初回のみ） ===
  call npm install
  if errorlevel 1 exit /b 1
)

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
