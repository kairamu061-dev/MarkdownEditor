/*
 * 配色の解決と適用
 *
 * 「選ばれたテーマの色 → 項目ごとの上書き」の順に重ねて 23 項目を決め、
 * documentElement の CSS 変数として設定する。nord.css の既定値は残したまま
 * インラインスタイルで上から被せる形（settings/ui のフォント適用と同じ手口）。
 */

import type { ThemeSettings, UserTheme } from "./api";
import {
  COLOR_ITEMS,
  DEFAULT_PRESET,
  PRESETS,
  isColorKey,
  isPresetName,
  type ColorKey,
  type PresetName,
} from "./palette";

const HEX = /^#[0-9a-f]{6}$/i;

/** `#rrggbb` 形式か（大文字小文字は問わない）。3 桁や 8 桁は受け付けない */
export function isValidColor(value: string): boolean {
  return HEX.test(value.trim());
}

/** 利用者テーマを表す接頭辞。組み込みの "nord" / "light" と名前空間を分ける */
export const USER_PREFIX = "user:";

export type ThemeChoice =
  | { kind: "preset"; name: string; label: string; dark: boolean; colors: Record<string, string> }
  | { kind: "user"; name: string; label: string; dark: boolean; colors: Record<string, string> };

/** 未知のプリセット名は既定（nord）として扱う */
export function resolvePreset(theme: ThemeSettings | null): PresetName {
  const name = theme?.preset;
  return name && isPresetName(name) ? name : DEFAULT_PRESET;
}

export function userThemeId(name: string): string {
  return USER_PREFIX + name;
}

export function findUserTheme(theme: ThemeSettings | null, name: string): UserTheme | undefined {
  return (theme?.userThemes ?? []).find((t) => t.name === name);
}

/**
 * `preset` の文字列を解決する。**解釈はここ 1 か所だけ。**
 * 未知の名前・既に削除された利用者テーマは、いずれも既定（nord）に落ちる
 */
export function resolveChoice(theme: ThemeSettings | null): ThemeChoice {
  const raw = theme?.preset;
  if (raw && raw.startsWith(USER_PREFIX)) {
    const found = findUserTheme(theme, raw.slice(USER_PREFIX.length));
    if (found) {
      return { kind: "user", name: found.name, label: found.name,
               dark: found.dark, colors: found.colors };
    }
    // 消したテーマを指したままの preset は拾わない
  }
  const preset = PRESETS[resolvePreset(theme)];
  return { kind: "preset", name: preset.name, label: preset.label,
           dark: preset.dark, colors: preset.colors };
}

/** 選択欄に並べる順（組み込み → 利用者テーマの登録順） */
export function themeChoices(theme: ThemeSettings | null): Array<{ id: string; label: string; kind: "preset" | "user" }> {
  const builtin = Object.values(PRESETS).map((p) => ({ id: p.name, label: p.label, kind: "preset" as const }));
  const user = (theme?.userThemes ?? [])
    .filter((t) => typeof t?.name === "string" && t.name !== "")
    .map((t) => ({ id: userThemeId(t.name), label: t.name, kind: "user" as const }));
  return [...builtin, ...user];
}

/**
 * 設定に入っている上書きのうち、**今の項目一覧にあって色として妥当なものだけ**を返す。
 * 未知の項目名・不正な色値は黙って捨てる（spec.md のエラーケース）。
 * 捨てる判断をここに集約しているので、Rust 側は素通しでよい
 */
export function sanitizeOverrides(theme: ThemeSettings | null): Partial<Record<ColorKey, string>> {
  const out: Partial<Record<ColorKey, string>> = {};
  for (const [key, value] of Object.entries(theme?.colors ?? {})) {
    if (typeof value === "string" && isColorKey(key) && isValidColor(value)) {
      out[key] = value.trim().toLowerCase();
    }
  }
  return out;
}

/**
 * 選ばれたテーマの色に上書きを重ねた、実際に適用される 23 色。
 * 利用者テーマは項目が欠けていることがあるので、**まず Nord で土台を埋めてから**
 * 重ねる（欠けた項目が undefined のまま CSS に出るのを防ぐ）
 */
export function resolvedColors(theme: ThemeSettings | null): Record<ColorKey, string> {
  const choice = resolveChoice(theme);
  const base = choice.kind === "preset"
    ? choice.colors
    : { ...PRESETS[choice.dark ? "nord" : "light"].colors, ...sanitizeColors(choice.colors) };
  return { ...base, ...sanitizeOverrides(theme) } as Record<ColorKey, string>;
}

/** 項目一覧にあって色として妥当なものだけを残す（利用者テーマの中身用） */
function sanitizeColors(colors: Record<string, string>): Partial<Record<ColorKey, string>> {
  const out: Partial<Record<ColorKey, string>> = {};
  for (const [key, value] of Object.entries(colors ?? {})) {
    if (typeof value === "string" && isColorKey(key) && isValidColor(value)) {
      out[key] = value.trim().toLowerCase();
    }
  }
  return out;
}

/** 最後に適用した設定。設定モーダルの初期表示とキャンセル時の復元に使う */
let applied: ThemeSettings = { preset: null, colors: {}, userThemes: [] };

export function currentTheme(): ThemeSettings {
  return {
    preset: applied.preset,
    colors: { ...applied.colors },
    userThemes: applied.userThemes.map((t) => ({ ...t, colors: { ...t.colors } })),
  };
}

type DarkListener = (dark: boolean) => void;

const darkListeners: DarkListener[] = [];
let currentDark = PRESETS[DEFAULT_PRESET].dark;

/**
 * dark/light の変化を購読する。**登録時に現在値で 1 回呼ぶ。**
 * initSettings() は mountEditor() より先に走るため、単純な通知だけだと
 * 起動直後の 1 回を取りこぼす
 */
export function subscribeDark(listener: DarkListener): void {
  darkListeners.push(listener);
  listener(currentDark);
}

/** 設定を画面へ適用する。22 項目を毎回すべて設定する */
export function applyTheme(theme: ThemeSettings | null): void {
  applied = {
    preset: theme?.preset ?? null,
    colors: { ...(theme?.colors ?? {}) },
    userThemes: (theme?.userThemes ?? []).map((t) => ({ ...t, colors: { ...t.colors } })),
  };
  const choice = resolveChoice(theme);
  const colors = resolvedColors(theme);
  const style = document.documentElement.style;

  // 一部だけ removeProperty すると、プリセットを切り替えたときに前の色が
  // 残って混ざる。常に 22 項目すべてを書く
  for (const item of COLOR_ITEMS) {
    style.setProperty(item.cssVar, colors[item.key]);
  }

  if (choice.dark !== currentDark) {
    currentDark = choice.dark;
    for (const listener of darkListeners) listener(currentDark);
  }
}
