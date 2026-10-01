// Mirrored in tailwind.config.js — update both together.

export const colors = {
  light: {
    background: "#FFF8F1", // cream
    surface: "#FFFFFF",
    surfaceMuted: "#F1EAE2", // mist
    text: "#2B2320", // charcoal
    textMuted: "#8A7F76", // stone
    primary: "#C1622A", // clay
    primaryPressed: "#9C4C1F", // clayDark
    accent: "#5C7A5E", // sage — success / "already have" / savings
    highlight: "#E0A93B", // gold — deals, score
    danger: "#B3433B",
    border: "#E7DDD2",
  },
  dark: {
    background: "#1C1613",
    surface: "#241D19",
    surfaceMuted: "#2E2621",
    text: "#F5EEE6",
    textMuted: "#A79A8D",
    primary: "#E0895A",
    primaryPressed: "#C1622A",
    accent: "#83A385",
    highlight: "#E7BD6B",
    danger: "#D77268",
    border: "#3A302A",
  },
} as const;

export type ThemeMode = keyof typeof colors;
export type ColorTokens = (typeof colors)[ThemeMode];
