/*
 * テーマファイルの組み立てと検証
 *
 * ファイルは **23 項目すべてを持つ自己完結した形式**にする。「Nord からの差分」に
 * すると、受け取った側の Nord が将来変わったときに意味が変わるため。
 *
 * 検証はここだけに置く。Rust 側（theme_io.rs）は読み書きするだけで中身を見ない。
 * 色の検証は settings/theme の isValidColor をそのまま使い、2 つ目を作らない。
 */

import type { UserTheme } from "./api";
import { COLOR_ITEMS, PRESETS, isColorKey, type ColorKey } from "./palette";
import { isValidColor } from "./theme";

export const THEME_FILE_FORMAT = "markdown-editor-theme";
export const THEME_FILE_VERSION = 1;

export type ParseResult =
  | { ok: true; theme: UserTheme; filled: number }
  | { ok: false; message: string };

/** 書き出す JSON 文字列。settings.json と同じく読める形に整形する */
export function buildThemeFile(
  name: string,
  dark: boolean,
  colors: Record<ColorKey, string>,
): string {
  // COLOR_ITEMS の順に並べる（項目順が安定していると差分が読める）
  const ordered: Record<string, string> = {};
  for (const item of COLOR_ITEMS) ordered[item.key] = colors[item.key];
  return JSON.stringify(
    { format: THEME_FILE_FORMAT, version: THEME_FILE_VERSION, name, dark, colors: ordered },
    null,
    2,
  );
}

/** 重複しない名前にする（"X" → "X (2)" → "X (3)"）。黙って上書きしないため */
export function uniqueName(name: string, existing: readonly string[]): string {
  if (!existing.includes(name)) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`;
    if (!existing.includes(candidate)) return candidate;
  }
}

/**
 * テーマファイルを検証して利用者テーマにする。
 *
 * **不正な色は拒否、足りない項目は補完**と扱いを分けている。不正な値はファイルの
 * 作り手の誤りなので黙って直さない。足りない項目は、こちらが将来項目を増やしたときに
 * 古いテーマファイルが全部読めなくなるのを避けるため。
 */
export function parseThemeFile(text: string, existingNames: readonly string[]): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: "テーマファイルの形式が正しくありません" };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, message: "テーマファイルの形式が正しくありません" };
  }
  const file = data as Record<string, unknown>;

  if (file.format !== THEME_FILE_FORMAT) {
    return { ok: false, message: "このファイルはテーマファイルではありません" };
  }
  if (typeof file.version !== "number" || file.version > THEME_FILE_VERSION) {
    return { ok: false, message: "このテーマファイルは新しいバージョンです" };
  }
  if (typeof file.name !== "string" || file.name.trim() === "") {
    return { ok: false, message: "テーマファイルの形式が正しくありません" };
  }
  if (typeof file.dark !== "boolean") {
    return { ok: false, message: "テーマファイルの形式が正しくありません" };
  }
  const rawColors = file.colors;
  if (typeof rawColors !== "object" || rawColors === null || Array.isArray(rawColors)) {
    return { ok: false, message: "テーマファイルの形式が正しくありません" };
  }

  const colors: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawColors as Record<string, unknown>)) {
    // 知らない項目名は捨てる（将来こちらが項目を減らしても読めるように）
    if (!isColorKey(key)) continue;
    if (typeof value !== "string" || !isValidColor(value)) {
      return {
        ok: false,
        // 形式そのものは正しく、色の値だけが不正。設定画面の 16 進入力欄の
        // メッセージ（「色の指定が正しくありません」）と言い回しを揃える
        message: `テーマファイルの色の指定が正しくありません（${key}: ${String(value)}）`,
      };
    }
    colors[key] = value.trim().toLowerCase();
  }

  // 足りない項目は明暗に合わせた組み込みプリセットで埋める
  const base = PRESETS[file.dark ? "nord" : "light"].colors;
  let filled = 0;
  for (const item of COLOR_ITEMS) {
    if (colors[item.key] === undefined) {
      colors[item.key] = base[item.key];
      filled++;
    }
  }

  return {
    ok: true,
    theme: { name: uniqueName(file.name.trim(), existingNames), dark: file.dark, colors },
    filled,
  };
}
