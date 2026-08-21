/*
 * 設定モーダルの配色セクション
 *
 * 編集中の値（draft）は保存するまでファイルに書かない。変更のたびに
 * applyTheme を呼んでプレビューし、キャンセル時は**モーダルを開いた時点の
 * スナップショット**を適用し直して戻す。
 */

import type { ThemeSettings } from "./api";
import {
  COLOR_ITEMS,
  GROUP_LABELS,
  PRESETS,
  isPresetName,
  type ColorGroup,
  type ColorItem,
} from "./palette";
import { applyTheme, isValidColor, resolvePreset, resolvedColors } from "./theme";

/** 既定で開いておくグループ。23 項目を一度に出すとモーダルが画面の高さを超える */
const OPEN_GROUP: ColorGroup = "basic";

const GROUP_ORDER: readonly ColorGroup[] = ["basic", "heading", "code", "other"];

export interface ThemeSection {
  element: HTMLElement;
  /** 現在の編集中の値。保存時に読む */
  draft(): ThemeSettings;
}

export function createThemeSection(initial: ThemeSettings): ThemeSection {
  // 参照を持ち回さないよう、開いた時点の値を複製して持つ
  const draft: ThemeSettings = {
    preset: initial.preset,
    colors: { ...initial.colors },
  };

  const section = document.createElement("div");
  section.className = "settings-theme";

  const heading = document.createElement("div");
  heading.className = "settings-theme-heading";
  heading.textContent = "配色";

  const presetField = document.createElement("label");
  presetField.className = "settings-field";
  presetField.textContent = "配色プリセット";
  const presetSelect = document.createElement("select");
  for (const preset of Object.values(PRESETS)) {
    const option = document.createElement("option");
    option.value = preset.name;
    option.textContent = preset.label;
    presetSelect.appendChild(option);
  }
  presetSelect.value = resolvePreset(draft);
  presetField.appendChild(presetSelect);

  const resetAll = document.createElement("button");
  resetAll.type = "button";
  resetAll.className = "settings-theme-reset-all";
  resetAll.textContent = "すべて初期値に戻す";

  section.append(heading, presetField, resetAll);

  // 項目 1 行ぶんの再描画に使う（値・上書き印・戻すボタンの表示）
  const refreshers: Array<() => void> = [];

  const preview = () => {
    applyTheme(draft);
    for (const refresh of refreshers) refresh();
  };

  for (const group of GROUP_ORDER) {
    const items = COLOR_ITEMS.filter((item) => item.group === group);
    if (items.length === 0) continue;

    const details = document.createElement("details");
    details.className = "settings-theme-group";
    details.open = group === OPEN_GROUP;
    const summary = document.createElement("summary");
    summary.textContent = GROUP_LABELS[group];
    details.appendChild(summary);

    for (const item of items) {
      const { row, refresh } = createRow(item, draft, preview);
      details.appendChild(row);
      refreshers.push(refresh);
    }
    section.appendChild(details);
  }

  presetSelect.addEventListener("change", () => {
    const next = presetSelect.value;
    if (!isPresetName(next)) return;
    draft.preset = next;
    // 上書きは全部捨てる。残すと配色が混ざって読めない画面になりうる
    // （そこから「すべて初期値に戻す」に辿り着けなくなる。spec.md 参照）
    draft.colors = {};
    preview();
  });

  resetAll.addEventListener("click", () => {
    draft.colors = {};
    preview();
  });

  return {
    element: section,
    draft: () => ({ preset: draft.preset, colors: { ...draft.colors } }),
  };
}

function createRow(
  item: ColorItem,
  draft: ThemeSettings,
  preview: () => void,
): { row: HTMLElement; refresh: () => void } {
  const row = document.createElement("div");
  row.className = "settings-color-row";

  const label = document.createElement("span");
  label.className = "settings-color-label";
  label.textContent = item.label;

  const overridden = document.createElement("span");
  overridden.className = "settings-color-overridden";
  overridden.textContent = "●";
  overridden.title = "既定から変更されています";

  const swatch = document.createElement("input");
  swatch.type = "color";
  swatch.className = "settings-color-swatch";

  const hex = document.createElement("input");
  hex.type = "text";
  hex.className = "settings-color-hex";
  hex.spellcheck = false;
  hex.maxLength = 7;

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "settings-color-reset";
  reset.textContent = "戻す";
  reset.title = "この項目を初期値に戻す";

  row.append(label, overridden, swatch, hex, reset);

  const refresh = () => {
    const value = resolvedColors(draft)[item.key];
    const isOverridden = typeof draft.colors[item.key] === "string";
    swatch.value = value;
    // 入力中の文字を横取りしない。フォーカスが無いときだけ書き戻す
    if (document.activeElement !== hex) hex.value = value;
    overridden.hidden = !isOverridden;
    reset.hidden = !isOverridden;
  };

  const set = (value: string) => {
    draft.colors[item.key] = value.toLowerCase();
    preview();
  };

  swatch.addEventListener("input", () => set(swatch.value));
  hex.addEventListener("input", () => {
    // 入力途中（"#8" など）はプレビューを更新しないだけ。エラーは出さない
    if (isValidColor(hex.value)) set(hex.value.trim());
  });
  reset.addEventListener("click", () => {
    delete draft.colors[item.key];
    preview();
  });

  refresh();
  return { row, refresh };
}

/**
 * 保存前の検証。16 進の入力欄に不正な値が残っていないかを見る。
 * 妥当でない値は draft に入らないので、ここで見るのは「入力途中のまま
 * 保存を押した」場合のみ
 */
export function invalidHexInputs(section: HTMLElement): string[] {
  const bad: string[] = [];
  for (const input of section.querySelectorAll<HTMLInputElement>(".settings-color-hex")) {
    const value = input.value.trim();
    if (value && !isValidColor(value)) bad.push(value);
  }
  return bad;
}
