import type { BlockContext, LeafBlock, LeafBlockParser, Line, MarkdownConfig } from "@lezer/markdown";

// 文章の直下の行が `-` 1 文字だけ（後ろの空白は可）なら、setext 見出しの下線とみなさない。
//
// CommonMark では `文章` + `-` の 2 行で `文章` が見出し 2 になる（下線は 1 文字以上なら
// 何文字でもよい）。文章の下に箇条書きを書こうとして `-` を打った瞬間に上の文章が見出しに
// 変わり、`- ` まで打っても戻らない — 空の項目は段落を中断できないため、下線の解釈が勝つ。
// `--` `---` `===` の下線見出しは従来どおり。
//
// Lezer の SetextHeading のリーフパーサを差し替えると、水平線の判定（「下線見出しが有効なら
// 段落直下の `---` は水平線ではない」）がその存在を参照しているため `---` が水平線に化ける。
// そこで本体は残し、生成されたインスタンスを包んで `-` 1 文字の行だけ素通りさせる。

function isSingleDash(line: Line): boolean {
  return (
    line.next === 45 /* '-' */ &&
    line.indent < line.baseIndent + 4 &&
    /^-[ \t]*$/.test(line.text.slice(line.pos))
  );
}

export const noSingleDashSetext: MarkdownConfig = {
  parseBlock: [
    {
      name: "SingleDashNotSetext",
      // SetextHeading の直後に置く。リーフパーサは名前の順に生成され、SetextHeading は
      // 必ずインスタンスを返すので、ここで呼ばれた時点の末尾がそのインスタンスになる
      after: "SetextHeading",
      leaf(_cx: BlockContext, leaf: LeafBlock): LeafBlockParser | null {
        const i = leaf.parsers.length - 1;
        const inner = leaf.parsers[i];
        if (!inner) return null;
        leaf.parsers[i] = {
          // false を返すと、その行は段落の続きとして本文に取り込まれる
          nextLine: (cx, line, lf) => !isSingleDash(line) && inner.nextLine(cx, line, lf),
          finish: (cx, lf) => inner.finish(cx, lf),
        };
        return null;
      },
    },
  ],
};
