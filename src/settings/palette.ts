/*
 * 配色の項目定義とプリセット（docs/settings/theme/spec.md の表と同一）
 *
 * 画面に出ている色は、すべてこの 22 項目のどれかに辿り着くこと。
 * どれにも属さない色が 1 つでも残ると、利用者が全項目を変えてもそこだけ
 * Nord の色が残り、ライトのプリセットで浮く。
 * 検査: grep -rhno "var(--[a-z0-9-]*" src/ が 22 項目 + 導出 4 個に収まること
 */

export type ColorKey =
  | "bgPrimary"
  | "bgSidebar"
  | "bgHover"
  | "border"
  | "text"
  | "textStrong"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6"
  | "codeKeyword"
  | "codeString"
  | "codeComment"
  | "codeNumber"
  | "codeType"
  | "accent"
  | "accentSecondary"
  | "syntaxMark"
  | "quote"
  | "error";

export type ColorGroup = "basic" | "heading" | "code" | "other";

export interface ColorItem {
  key: ColorKey;
  /** documentElement に設定する CSS カスタムプロパティ名 */
  cssVar: string;
  label: string;
  group: ColorGroup;
}

export const GROUP_LABELS: Record<ColorGroup, string> = {
  basic: "基本",
  heading: "見出し",
  code: "コード",
  other: "その他",
};

export const COLOR_ITEMS: readonly ColorItem[] = [
  { key: "bgPrimary", cssVar: "--bg-primary", label: "背景", group: "basic" },
  { key: "bgSidebar", cssVar: "--bg-sidebar", label: "サイドバー背景", group: "basic" },
  { key: "bgHover", cssVar: "--bg-hover", label: "選択・ホバー背景", group: "basic" },
  { key: "border", cssVar: "--border", label: "罫線", group: "basic" },
  { key: "text", cssVar: "--text", label: "文字", group: "basic" },
  { key: "textStrong", cssVar: "--text-strong", label: "強調文字", group: "basic" },

  { key: "heading1", cssVar: "--heading1", label: "見出し 1", group: "heading" },
  { key: "heading2", cssVar: "--heading2", label: "見出し 2", group: "heading" },
  { key: "heading3", cssVar: "--heading3", label: "見出し 3", group: "heading" },
  { key: "heading4", cssVar: "--heading4", label: "見出し 4", group: "heading" },
  { key: "heading5", cssVar: "--heading5", label: "見出し 5", group: "heading" },
  { key: "heading6", cssVar: "--heading6", label: "見出し 6", group: "heading" },

  { key: "codeKeyword", cssVar: "--code-keyword", label: "キーワード", group: "code" },
  { key: "codeString", cssVar: "--code-string", label: "文字列", group: "code" },
  { key: "codeComment", cssVar: "--code-comment", label: "コメント", group: "code" },
  { key: "codeNumber", cssVar: "--code-number", label: "数値・真偽値", group: "code" },
  { key: "codeType", cssVar: "--code-type", label: "型名・クラス名", group: "code" },

  { key: "accent", cssVar: "--accent", label: "アクセント", group: "other" },
  { key: "accentSecondary", cssVar: "--accent-secondary", label: "第 2 アクセント", group: "other" },
  { key: "syntaxMark", cssVar: "--syntax-mark", label: "記法マーク", group: "other" },
  { key: "quote", cssVar: "--quote-bar", label: "引用", group: "other" },
  { key: "error", cssVar: "--error", label: "エラー", group: "other" },
];

export type PresetName = "nord" | "light";

export interface Preset {
  name: PresetName;
  label: string;
  /** CodeMirror の EditorView.darkTheme に渡す。既定スタイルの明暗が切り替わる */
  dark: boolean;
  colors: Record<ColorKey, string>;
}

export const DEFAULT_PRESET: PresetName = "nord";

export const PRESETS: Record<PresetName, Preset> = {
  nord: {
    name: "nord",
    label: "Nord（ダーク）",
    dark: true,
    // nord.css の既定値と同じ色。ここを変えると既定の見た目が変わる
    colors: {
      bgPrimary: "#2e3440",
      bgSidebar: "#3b4252",
      bgHover: "#434c5e",
      border: "#4c566a",
      text: "#d8dee9",
      textStrong: "#eceff4",
      heading1: "#ebcb8b",
      heading2: "#a3be8c",
      heading3: "#b48ead",
      heading4: "#88c0d0",
      heading5: "#81a1c1",
      heading6: "#81a1c1",
      codeKeyword: "#81a1c1",
      codeString: "#a3be8c",
      // color-mix(in srgb, var(--text) 40%, var(--border)) の実効値
      codeComment: "#848c9d",
      codeNumber: "#b48ead",
      codeType: "#8fbcbb",
      accent: "#88c0d0",
      accentSecondary: "#81a1c1",
      syntaxMark: "#5e81ac",
      quote: "#81a1c1",
      error: "#bf616a",
    },
  },
  light: {
    name: "light",
    label: "ライト",
    dark: false,
    colors: {
      bgPrimary: "#ffffff",
      bgSidebar: "#f2f3f5",
      bgHover: "#dfe3e8",
      border: "#c4cad2",
      text: "#2e3440",
      textStrong: "#1c2028",
      heading1: "#b58900",
      heading2: "#4f7a3f",
      heading3: "#8b5a96",
      heading4: "#2c7a8c",
      heading5: "#3b6ea5",
      heading6: "#3b6ea5",
      codeKeyword: "#3b6ea5",
      codeString: "#4f7a3f",
      codeComment: "#7a8494",
      codeNumber: "#8b5a96",
      codeType: "#2c7a8c",
      accent: "#2c7a8c",
      accentSecondary: "#3b6ea5",
      syntaxMark: "#6b7d99",
      quote: "#3b6ea5",
      error: "#a3343d",
    },
  },
};

export function isPresetName(value: string | null | undefined): value is PresetName {
  return value === "nord" || value === "light";
}

const COLOR_KEYS = new Set<string>(COLOR_ITEMS.map((item) => item.key));

export function isColorKey(value: string): value is ColorKey {
  return COLOR_KEYS.has(value);
}
