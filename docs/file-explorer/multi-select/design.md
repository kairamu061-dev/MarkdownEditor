# file-explorer/multi-select 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| マウスイベント（mousedown / mousemove / mouseup） | 範囲選択 | HTML5 DnD は行の移動に使っているため、範囲選択は素のマウスイベントで別に組む |
| HTML5 DnD（既存） | まとめて移動 | tree-view のドロップ先（フォルダ行・ツリー空白部）をそのまま使える。運ぶ中身を「1 件」から「パスの配列」に広げるだけ |
| `color-mix()` | 選択色・四角の色 | `--accent` から半透明色を作り、テーマ変数を増やさない（theme-io の書き出し項目・テーマ JSON の形を変えない） |

## アーキテクチャ

```
src/explorer/selection.ts   （新規）選択状態と範囲選択
  ├─ 選択集合 Set<string>（ノートの相対パス）
  ├─ initMarquee(container)   範囲選択のマウス処理・四角の描画・自動スクロール・クリック抑止
  └─ 選択集合の操作（isSelected / toggle / clear / remap / retain / selectedPaths）

src/explorer/index.ts       （変更）tree-view 本体
  ├─ renderNodes            選択中の行に .selected を付ける。Ctrl+クリックで toggle、通常クリックで clear
  ├─ renderTree             ツリーに存在しないパスを選択から外す（retain）
  ├─ makeDraggable          dragstart で運ぶパスを決める（選択中なら選択全体）
  ├─ canDrop / doMove       パスの配列を扱う
  ├─ remapPrefix            選択も一緒に付け替える
  └─ applyVault / Esc       選択を全解除
```

selection.ts は index.ts を import しない（循環を避ける）。選択が変わったら
`.tree-row[data-path]` の `selected` クラスを selection.ts 自身が付け直す
（ツリー全体の再描画はしない。範囲選択中に毎フレーム再描画すると重く、行要素も作り直されるため）。

### 範囲選択の開始判定

- `container`（`#sidebar-content`）の mousedown（左ボタン）で判定する
- 押した要素が `.tree-label` / `.tree-chevron` の中なら何もしない（従来の DnD・クリックへ）
- `.tree` の外（保管庫未オープン時のボタンなど）も対象外
- それ以外では **mousedown を `preventDefault()`** する。行は `draggable` なので、
  これをしないと行の空白からのドラッグがネイティブ DnD として始まってしまう。
  文字列の選択も同時に止まる。click は preventDefault の影響を受けないので、
  動かさずに離せば従来どおりのクリックになる

### 座標系

`container` はスクロールする要素で、かつ `position: relative`。四角は container の子として
絶対配置するので、**コンテンツ座標**（`clientY - rect.top + scrollTop`）で持てばスクロールに
追従する。行の当たり判定も同じ座標系に直して比べる。`display: none` の行（折りたたまれた
フォルダの中）は矩形の幅・高さが 0 なので除外する。

### クリック抑止

範囲選択を終えた mouseup の直後に発火する click を、container の **capture** フェーズで
1 回だけ止める。フラグは `setTimeout(0)` で必ず下ろす（mouseup が container の外だと click は
container に届かず、フラグが残ると次の本物のクリックを食うため）。

### まとめて移動

1. dragstart: 掴んだノートが選択中なら `dragPaths = 選択全体`、そうでなければ `[掴んだパス]`。
   2 件以上なら「N 件のノート」と書いた要素を `setDragImage` に渡す
2. canDrop(toDir): `movableTo(toDir)` が 1 件以上なら可。自身・子孫が含まれていれば不可（フォルダ単体の移動のため）。
   すでに toDir にあるものは除外する
3. drop: 開いているノートが移動対象（またはその配下）なら `flushSave()` で保存待ちを確定し、
   それでも未保存分が残れば移動しない（`renameCurrentNote` と同じ扱い）→ `movePath` を 1 件ずつ順に → 成功したものごとに
   `remapPaths` → 最後に 1 回だけ `refreshTree` → 失敗件数をステータスへ

## データ構造

```ts
// selection.ts
const selected = new Set<string>(); // ノートの保管庫相対パス

// index.ts の ExplorerState
dragPaths: string[]; // 旧 dragPath: string | null。空配列 = ドラッグしていない
```

## インターフェース

```ts
// src/explorer/selection.ts
export function isSelected(path: string): boolean;
export function selectedPaths(): string[];            // 文書順ではなく挿入順
export function toggleSelected(path: string): void;
export function clearSelection(): void;
export function remapSelection(remap: (p: string) => string): void;
export function retainSelection(exists: Set<string>): void;
export function initMarquee(container: HTMLElement): void;

// src/explorer/index.ts（内部）
function movableTo(toDir: string): string[];
async function doMove(paths: string[], toDir: string): Promise<void>;
```

## 依存関係

- tree-view（ツリー描画・DnD のドロップ先・`flushPendingSave`）
- vault の `move_path` コマンド（変更なし）
