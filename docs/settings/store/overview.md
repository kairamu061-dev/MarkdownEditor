# settings/store 概要

## 目的・背景

設定の永続化基盤。vault-restore / ui が使う settings.json の読み書きを Rust 側に提供する。

## スコープ

### 作るもの

- `Settings` スキーマ（lastVault、editor.fontFamily / fontSize）
- 読み込み・保存の純関数（テスト可能な形）と Tauri コマンド（get_settings / save_settings）
- 壊れたファイル・未存在ファイルのフォールバック（デフォルト値）
- ユニットテスト

### 作らないもの

- UI（→ ui）・ヴォールト復元ロジック（→ vault-restore）
- 設定ファイルの監視・マイグレーション

## 制約

- 保存先は app_config_dir 直下の `settings.json`（人が読める pretty JSON）
- 読み込み失敗で起動をブロックしない

## 完了条件

- get_settings / save_settings が動作し、ユニットテスト（デフォルト・往復・破損時フォールバック）が通る

## 画面イメージ

（UI なし）
