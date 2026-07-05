# editor/code-highlight 設計

## 技術選定

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| @codemirror/language-data | 言語レジストリ | 公式の言語一覧。LanguageDescription による動的 import で遅延ロードが標準装備 |

## アーキテクチャ

- `src/editor/index.ts` の `markdown()` に `codeLanguages: languages` を渡す（1 行の変更）
- コードトークンの配色は `src/editor/theme.ts` の `nordHighlightStyle` にタグ定義を追加
- `src/editor/code-block.ts`: フェンスコードブロックの行に Line Decoration で
  等幅フォント・0.9em・背景色を適用する（言語トークンは markdown の monospace タグを
  持たないため、行単位で当てる必要がある。ブロック全体の背景は Obsidian 同様の見た目にもなる）
- ビルド上は言語パーサが言語ごとの chunk に分割される（vite の dynamic import）

## データ構造

（なし — CodeMirror の LanguageDescription をそのまま使用）

## インターフェース

```typescript
// src/editor/index.ts（変更）
import { languages } from "@codemirror/language-data";
markdown({ base: markdownLanguage, codeLanguages: languages })
```

## 依存関係

| ライブラリ / サービス | 用途 |
|-----------------------|------|
| @codemirror/language-data ^6 | 言語レジストリ（各言語パッケージは遅延ロード） |
