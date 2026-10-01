// Role tokens per palette and mode. Contrast is checked to WCAG AA (design-system.md).
const forest = {
  light: {
    background: "#F7F1E1",
    backgroundMuted: "#EFE5CB",
    surface: "#FFFDF7",
    surfaceElevated: "#FFFFFF",
    text: "#1F2A1C",
    textMuted: "#56624F",
    brandAccent: "#386641",
    brandAccentPressed: "#2A4D31",
    onBrandAccent: "#FFFFFF",
    secondaryAccent: "#6A994E",
    success: "#3F7A2E",
    highlight: "#A7C957",
    criticalError: "#A93C3E",
    border: "#DDD3B6",
  },
  dark: {
    background: "#121811",
    backgroundMuted: "#1E261C",
    surface: "#192118",
    surfaceElevated: "#212B1F",
    text: "#F2E8CF",
    textMuted: "#B4B9A2",
    brandAccent: "#A7C957",
    brandAccentPressed: "#8DB043",
    onBrandAccent: "#16220F",
    secondaryAccent: "#6A994E",
    success: "#A7C957",
    highlight: "#A7C957",
    criticalError: "#E58587",
    border: "#313D2D",
  },
};

const autumn: typeof forest = {
  light: {
    background: "#FFF6DD",
    backgroundMuted: "#FBE6B3",
    surface: "#FFFBF0",
    surfaceElevated: "#FFFFFF",
    text: "#432818",
    textMuted: "#76563C",
    brandAccent: "#99582A",
    brandAccentPressed: "#6F3E1C",
    onBrandAccent: "#FFFFFF",
    secondaryAccent: "#BB9457",
    success: "#5F6B24",
    highlight: "#BB9457",
    criticalError: "#6F1D1B",
    border: "#E8D5A6",
  },
  dark: {
    background: "#1C120B",
    backgroundMuted: "#2A1B11",
    surface: "#24170E",
    surfaceElevated: "#2E1E13",
    text: "#FFE6A7",
    textMuted: "#CDB389",
    brandAccent: "#D9955C",
    brandAccentPressed: "#C07B42",
    onBrandAccent: "#2A160A",
    secondaryAccent: "#BB9457",
    success: "#C9BC6E",
    highlight: "#BB9457",
    criticalError: "#EE8F86",
    border: "#3E2B1D",
  },
};

export const palettes = { forest, autumn };

export type PaletteName = keyof typeof palettes;
export type ThemeMode = keyof typeof forest;
export type ColorTokens = typeof forest.light;
