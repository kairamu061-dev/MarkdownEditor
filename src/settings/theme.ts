/*
 * 配色の解決と適用
 *
 * 「プリセットの色 → 利用者の上書き」の順に重ねて 22 項目を決め、
 * documentElement の CSS 変数として設定する。nord.css の既定値は残したまま
 * インラインスタイルで上から被せる形（settings/ui のフォント適用と同じ手口）。
 */

import type { ThemeSettings } from "./api";
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

/** 未知のプリセット名は既定（nord）として扱う */
export function resolvePreset(theme: ThemeSettings | null): PresetName {
  const name = theme?.preset;
  return name && isPresetName(name) ? name : DEFAULT_PRESET;
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

/** プリセットの色に上書きを重ねた、実際に適用される 22 色 */
export function resolvedColors(theme: ThemeSettings | null): Record<ColorKey, string> {
  return { ...PRESETS[resolvePreset(theme)].colors, ...sanitizeOverrides(theme) };
}

/** 最後に適用した設定。設定モーダルの初期表示とキャンセル時の復元に使う */
let applied: ThemeSettings = { preset: null, colors: {} };

export function currentTheme(): ThemeSettings {
  return { preset: applied.preset, colors: { ...applied.colors } };
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
  applied = { preset: theme?.preset ?? null, colors: { ...(theme?.colors ?? {}) } };
  const preset = PRESETS[resolvePreset(theme)];
  const colors = resolvedColors(theme);
  const style = document.documentElement.style;

  // 一部だけ removeProperty すると、プリセットを切り替えたときに前の色が
  // 残って混ざる。常に 22 項目すべてを書く
  for (const item of COLOR_ITEMS) {
    style.setProperty(item.cssVar, colors[item.key]);
  }

  if (preset.dark !== currentDark) {
    currentDark = preset.dark;
    for (const listener of darkListeners) listener(currentDark);
  }
}
