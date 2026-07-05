# file-explorer/file-ops 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| 素の TypeScript + DOM | メニュー・インライン入力 | プロジェクト方針。ネイティブメニューよりテーマ統一が容易 |

## アーキテクチャ

```
src/explorer/
└── file-ops.ts   # [+] ボタン・コンテキストメニュー・リネーム入力・削除確認
```

- tree-view（index.ts）が公開する内部フック（ツリー再取得 `refreshTree`、ノートオープン `openNote`、
  編集中パスの取得/更新）を使って実装する。vault コマンドは api.ts 経由
- コンテキストメニューは単一のシングルトン要素を使い回す（開くたびに項目を再構築）
- 新規ノートの連番はフロントで既存ツリーから計算し、`create_note` の already exists エラー時は次の連番で 1 回だけ再試行

## データ構造

```typescript
// file-ops.ts 内部
interface MenuTarget {
  path: string;      // 対象ノートのヴォールト相対パス
  row: HTMLElement;  // 対象の行要素（インライン入力の差し替え先）
}
```

## インターフェース

```typescript
// src/explorer/file-ops.ts
export function initFileOps(): void; // index.ts の initExplorer から呼ばれる

// src/explorer/index.ts に追加する公開フック
export function refreshTree(): Promise<void>;
export function getCurrentPath(): string | null;
export function setCurrentPath(path: string | null): void; // null でスクラッチ扱いに戻す
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| file-explorer/vault のコマンド | create_note / rename_path / delete_path / list_tree |
| file-explorer/tree-view | ツリー再描画・行要素・編集中パス管理 |
