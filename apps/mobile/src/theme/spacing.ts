import { Platform, StyleSheet } from "react-native";

// 4pt baseline.
export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Paired with borderCurve: "continuous" (iOS squircle); values follow the MD3 shape scale.
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  pill: 999,
} as const;

/** Minimum touch target: 44pt (Apple HIG), 48dp (Material 3). */
export const minTouch = Platform.select({ ios: 44, default: 48 });

/** 0.5pt on 2x screens. */
export const hairline = StyleSheet.hairlineWidth;
