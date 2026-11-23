# editor/tabs 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| `EditorView` 1 つ + タブごとの `EditorState` | 編集状態の保持 | `EditorState` は不変値なので、退避して `view.setState()` で戻すだけで undo 履歴・選択が復元される。タブの数だけビューを作るより軽く、拡張（live-preview 等）の二重登録も起きない |
| スクロール位置の個別退避（`view.scrollSnapshot()`） | スクロール復元 | スクロール位置はビュー側にあり `EditorState` に含まれないため。px ではなく行位置で持つ（BUG-038） |
| 素の DOM（`<div>` の並び） | タブバー | inline-title・ツリーと同じ実装パターン。CodeMirror の外に置く |
| ウィンドウの `keydown` | Ctrl+Tab / Ctrl+W | フォーカスがエディタ外（inline-title・ツリー）にあっても効かせるため。CodeMirror の keymap はエディタにフォーカスがあるときしか動かない |

## アーキテクチャ

```
index.html                  # 変更: #tab-bar を #note-title の前に追加
src/editor/index.ts         # 変更: EditorHandle に saveSession / restoreSession を追加
src/editor/tabs.ts          # 新規: タブの並び・セッション保持・タブバー描画・キー操作
src/editor/inline-title.ts  # 変更: displayName を export（タブのラベルと規則を揃える）
src/explorer/index.ts       # 変更: openNote のタブ対応、切り替え・閉じる処理、追随
src/explorer/file-ops.ts    # 変更: 「新しいタブで開く」メニュー、削除時のタブ閉じ
src/main.ts                 # 変更: 配線
src/styles/app.css          # 変更: .tab-bar のスタイル
```

### 責務の分担

- **`tabs.ts` は保管庫を知らない。** ノートのパスは不透明なキーとして受け取るだけ。
  タブのクリック・×・中クリック・キー操作は、自分で状態を変えずに `onSelect` / `onClose` を呼ぶ
- **explorer が手順を持つ。** 保存の確定 → `tabs.activate` / `tabs.close` → `currentPath` の更新、の順で行う。
  保存の確定は explorer の責務（`flushSave` がそこにある）なので、切り替えの可否も explorer が決める
- `state.currentPath` は「アクティブなタブのキー」と常に一致させる。`currentPath` を前提にした既存の処理
  （自動保存・inline-title・ウィンドウを閉じるときの保存・`doMove` の保存確定）は変更しない

### 不変条件: 保存待ちを持つのはアクティブなタブだけ

`flushSave` は書き込み先を **確定時点の** `state.currentPath` から決める。
先に `currentPath` を切り替えてから確定すると、タブ A の本文がタブ B のファイルへ書き込まれる。
そこで、アクティブなタブが変わる操作はすべて次の順にする。

```
[切り替え / 閉じる / 読み込み済みのノートで置き換え / 保管庫切り替え]
      |
1. settleSave()          <- flushSave を確定。確定中に入力があればもう 1 回。
      |                     保存待ちが残ったら false（失敗）
      |  false → ステータス表示して中止（アクティブなタブはそのまま）
      |
2. tabs.activate / close / replaceActive / openNew / closeAll   <- 同期処理。間に await を挟まない
      |
3. setCurrentPathInternal(tabs.active())
```

ノートを新しく開く場合は、**読み込み（`readNote`）を 1. より前に済ませる。**
読み込みを待つ間に入力があっても、1. がそれを確定してから置き換えるため取りこぼさない。

### ツリーからの開き方

```
openNote(path, { newTab })
  1. tabs.has(path) → 2 を飛ばし、そのタブへの切り替え（settle → activate）
  2. content = await readNote(path)   失敗 → 「読み込みに失敗しました」、何も変えない
  3. settleSave()                     失敗 → 「保存できていないため切り替えられません」
  4. newTab ? tabs.openNew(path, content) : tabs.replaceActive(path, content)
  5. setCurrentPathInternal / focus / renderTree
```

- ノート行の `auxclick`（`button === 1`）で `openNote(path, { newTab: true })`
- WebView2 は中ボタンの `mousedown` で自動スクロールを始めるため、ノート行とタブで `mousedown`（`button === 1`）を `preventDefault` する
- 右クリックメニューの「新しいタブで開く」は file-ops から `openNoteInNewTab(path)` を呼ぶ

### 追随

| 呼び出し元 | 処理 |
|-----------|------|
| `remapPrefix`（リネーム・移動） | `tabs.remap(remap)` → `setCurrentPathInternal(tabs.active())` |
| `doDelete`（file-ops） | `closeNotesUnder(path)`。該当タブを閉じ、アクティブだったなら保存待ちを捨てる（削除済みのファイルへ書かない） |
| `applyVault` | `tabs.closeAll()`。呼び出し元（`switchToVault` / `openVaultByDialog`）が先に `settleSave` する |

`setCurrentPath` / `getCurrentPath` は file-ops の削除処理でしか使っていなかったため、`closeNotesUnder` に置き換えて削除する。

### 閉じたときの移動先

アクティブなタブを閉じたら、右隣、無ければ左隣を `restoreSession` する。
残りが無ければ `editor.setContent("")` でスクラッチ文書に戻す（従来の削除時・保管庫切り替え時と同じ見た目）。

### セッションの退避と復元（core）

- `saveSession()` は `{ state: view.state, scroll: view.scrollSnapshot() }` を返す
- `restoreSession(s)` は `view.setState(s.state)` のあと、1 回の dispatch で
  - `darkCompartment` を現在の明暗で reconfigure する（裏にいる間に配色プリセットが変わっていても揃える）
  - `s.scroll`（スクロールのスナップショット）を流す。先頭に見えていた行とそこからのずれで戻すので、
    `setState` 直後に見えていない行の高さが推定値でも位置がずれない（BUG-038。当初は `scrollTop` を px で戻していた）
- `setState` はトランザクションを経由しないため `onDocChanged` は呼ばれない。切り替えだけで保存が走ることはない

## データ構造

```typescript
// src/editor/index.ts
/** タブ切り替え用に退避した編集状態。中身は core の外では触らない */
export interface EditorSession {
  readonly state: EditorState;
  readonly scroll: ReturnType<EditorView["scrollSnapshot"]>; // 行位置ベースのスクロール（BUG-038）
}

// src/editor/tabs.ts（モジュール内部）
interface Tab {
  key: string;                  // 保管庫相対パス（tabs.ts は意味を解釈しない）
  session: EditorSession | null; // アクティブなタブは null（実体はエディタにある）
}
// 並び順 = 配列の順。active は tabs 配列内のキー、または null（タブなし）
```

## インターフェース

```typescript
// src/editor/index.ts（EditorHandle に追加）
interface EditorHandle {
  // ...既存
  /** 現在の編集状態を退避する */
  saveSession(): EditorSession;
  /** 退避した編集状態へ戻す。明暗は現在の設定に合わせ直す */
  restoreSession(session: EditorSession): void;
}

// src/editor/tabs.ts
export interface TabsOptions {
  /** タブのクリック、Ctrl+Tab / Ctrl+Shift+Tab の移動先 */
  onSelect: (key: string) => void;
  /** ×・タブの中クリック・Ctrl+W */
  onClose: (key: string) => void;
}

export interface TabsHandle {
  keys(): string[];
  active(): string | null;
  has(key: string): boolean;
  /** アクティブなタブの右に新しいタブを作り、content で表示する */
  openNew(key: string, content: string): void;
  /** アクティブなタブを key / content に置き換える。タブが無ければ openNew と同じ */
  replaceActive(key: string, content: string): void;
  /** 既存のタブへ切り替える。現在のタブの状態は退避する */
  activate(key: string): void;
  /** タブを閉じる。アクティブなら右隣（無ければ左隣）へ、残りが無ければスクラッチに戻す */
  close(key: string): void;
  closeAll(): void;
  /** すべてのキーを付け替える（リネーム・移動の追随） */
  remap(fn: (key: string) => string): void;
}

export function mountTabs(bar: HTMLElement, editor: EditorHandle, options: TabsOptions): TabsHandle;

// src/explorer/index.ts（追加・変更）
export function openNote(relPath: string, opts?: { newTab?: boolean }): Promise<void>;
export function openNoteInNewTab(relPath: string): Promise<void>;
export function selectTab(key: string): Promise<void>;
export function closeTab(key: string): Promise<void>;
/** 削除した path（フォルダなら配下も）のタブを閉じる */
export function closeNotesUnder(path: string): void;
export function initExplorer(el: HTMLElement, editor: EditorHandle, tabs: TabsHandle): void;
// 削除: getCurrentPath / setCurrentPath
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| `@codemirror/state` / `@codemirror/view` | `EditorState` の退避・`setState` による復元（既存の依存） |
