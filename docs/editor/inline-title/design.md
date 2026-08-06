# editor/inline-title 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| 素の DOM（`<div>` + `<input>` 差し替え） | タイトル行 | CodeMirror の外に置く独立要素。既存のツリーリネーム（`startRename`）と同じ実装パターンで揃う |
| CodeMirror 拡張ではなく兄弟要素 | 配置 | 本文の一部にすると文書テキストに影響しうる。H1 連動をしない方針（overview 参照）とも整合し、エディタの状態管理から完全に切り離せる |
| 購読コールバック（`onCurrentNoteChanged`） | 表示の追随 | `state.currentPath` を変える箇所が 4 つ（`openNote` / `remapPrefix` / `applyVault` / `setCurrentPath`）に散っており、各所から直接 DOM を触ると結合が増える |

## アーキテクチャ

```
index.html                     # #note-title を #main-content の前に追加
src/editor/inline-title.ts     # 新規: タイトル行の描画・編集・確定
src/explorer/index.ts          # 変更: currentPath 変化の通知、flushSave の公開
src/main.ts                    # 変更: 配線
src/styles/app.css             # 変更: .note-title のスタイル
```

### 責務の分担

- `inline-title.ts` は**保管庫を知らない**。表示名の算出と入力 UI だけを持ち、
  確定時は `onRename(newBaseName)` コールバックを呼ぶ（editor 配下の既存方針と同じ）
- リネームの実処理（`flushSave` → `renamePath` → `remapAfterRename` → `refreshTree`）は
  file-explorer 側に置き、`main.ts` が両者を配線する

### 表示の追随

`src/explorer/index.ts` に購読の仕組みを追加する。

```
state.currentPath を変更する箇所
  ├─ openNote()        ノートを開いた
  ├─ remapPrefix()     リネーム / 移動でパスが変わった
  ├─ applyVault()      保管庫を切り替えた（null になる）
  └─ setCurrentPath()  外部から設定された
        ↓ すべて notifyCurrentNoteChanged() を通す
   購読者（inline-title）が表示を更新
```

既存の代入箇所を直接呼び出しに置き換えるのではなく、**代入を 1 箇所の内部関数に集約**してからそこで通知する。
代入漏れによる表示ずれを防ぐため。

### 確定フロー

```
[Enter / 妥当な blur]
      |
1. flushSave()            <- 保留中の本文保存を先に確定（順序が逆だと旧パスへ飛ぶ）
      |
2. 検証（空 / "/" "\" / 変更なし）
      |
3. renamePath(from, to)   <- 失敗時: 同名なら入力を残して再試行、他はステータス表示して戻す
      |
4. remapAfterRename(from, to)
      |
5. refreshTree()
      |
6. 表示状態へ戻し、エディタ本文へフォーカスを返す
```

## データ構造

```typescript
// src/editor/inline-title.ts
interface InlineTitleOptions {
  /** 確定時に呼ばれる。成功なら true、失敗（入力を残したい）なら false を返す */
  onRename: (newBaseName: string) => Promise<boolean>;
  /** 確定・破棄の後にフォーカスを戻す先 */
  onDone: () => void;
}

interface InlineTitleHandle {
  /** 表示を更新する。null はスクラッチ文書（「無題」・編集不可） */
  setPath(relPath: string | null): void;
}
```

表示名の算出はツリーのリネームと同じ規則に揃える（`file-ops.ts:76-78`）。

```
"買い物リスト.md"        -> "買い物リスト"
"sub/買い物リスト.md"    -> "買い物リスト"
null                     -> "無題"（編集不可）
```

## インターフェース

```typescript
// src/editor/inline-title.ts（新規）
export function mountInlineTitle(
  host: HTMLElement,
  options: InlineTitleOptions,
): InlineTitleHandle;

// src/explorer/index.ts（追加）
/** currentPath が変わったときに呼ばれる購読を登録する */
export function onCurrentNoteChanged(cb: (path: string | null) => void): void;

/** 保留中の自動保存を確定する（リネーム前に呼ぶ用に公開） */
export function flushPendingSave(): Promise<void>;

/** タイトル行からのリネーム。成功なら true */
export function renameCurrentNote(newBaseName: string): Promise<boolean>;
```

```typescript
// src/main.ts での配線
const title = mountInlineTitle(document.getElementById("note-title")!, {
  onRename: (name) => renameCurrentNote(name),
  onDone: () => editor.focus(),
});
onCurrentNoteChanged((path) => title.setPath(path));
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| （追加なし） | 既存の `renamePath` Tauri コマンドと DOM API のみで実装する |

## 既存コードへの影響

| 対象 | 変更内容 | 理由 |
|------|---------|------|
| `src/explorer/index.ts` | `state.currentPath` への代入を内部関数へ集約し通知を発火 | 表示追随。代入漏れ防止 |
| `src/explorer/index.ts` | `flushSave` を `flushPendingSave` として公開 | リネーム前のフラッシュに必要 |
| `src/explorer/file-ops.ts` | `startRename` の確定前にも `flushSave` を追加 | ツリー経由のリネームにも同じ取りこぼしリスクがあるため（既存の穴を同時に塞ぐ） |
| `index.html` | `#note-title` を追加 | `.main` が `flex-direction: column` のため、タイトル行 + `flex:1` のエディタで収まる |
| `src/styles/app.css` | `.note-title` 追加 | Nord 配色に合わせる |
