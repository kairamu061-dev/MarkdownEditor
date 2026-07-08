# file-explorer/tree-view 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| 素の TypeScript + DOM | ツリー描画 | プロジェクト方針（UI フレームワーク不使用） |
| @tauri-apps/api の invoke | vault コマンド呼び出し | Tauri 標準の IPC |

## アーキテクチャ

```
src/explorer/
├── index.ts       # initExplorer: 状態管理・ツリー描画・エディタ接続・保存
├── api.ts         # vault コマンドの型付き invoke ラッパ
└── explorer.css   # ツリー・ボタン・ステータスのスタイル
```

- explorer が持つ状態: 保管庫情報（名前・ツリー）、開いているノートの相対パス、保存デバウンスタイマー
- main.ts が `mountEditor` の `onDocChanged` を explorer に配線する（editor のコードは不変更）
- ツリー描画は全再描画方式（保管庫規模が小さいうちは十分軽い。仮想化は将来）
- ノード名は `textContent` で挿入する（HTML インジェクション防止）

## データ構造

```typescript
// api.ts — vault の TreeNode / VaultInfo と同型
interface TreeNode { name: string; path: string; isDir: boolean; children: TreeNode[] }
interface VaultInfo { name: string; tree: TreeNode[] }

// index.ts 内部状態
interface ExplorerState {
  vault: VaultInfo | null;
  currentPath: string | null;   // 開いているノートの保管庫相対パス
  saveTimer: number | null;     // デバウンスタイマー ID
  pendingContent: string | null; // 未保存の最新内容
}
```

## インターフェース

```typescript
// src/explorer/index.ts
export function initExplorer(container: HTMLElement, editor: EditorHandle): void;
// 内部: openVault / renderTree / openNote / scheduleSave / saveNow / showStatus
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| @tauri-apps/api ^2 | invoke（導入済み） |
| file-explorer/vault のコマンド | ファイル I/O |
| editor/core の EditorHandle | 内容の取得・差し替え・変更通知 |
