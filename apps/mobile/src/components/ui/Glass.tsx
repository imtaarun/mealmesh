import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useTheme } from "@/theme";

// Liquid Glass for the control layer only (tab bar, floating controls) — never on content.
// Native on iOS 26+, emulated with a blur on older iOS, a Material tonal surface on Android.
export function Glass({ children, style }: PropsWithChildren<{ style?: ViewProps["style"] }>) {
  const { colors, radius, hairline, mode } = useTheme();
  const shape = { borderRadius: radius.pill, borderCurve: "continuous" as const };

  if (Platform.OS === "android") {
    return <View style={[shape, { backgroundColor: colors.surfaceElevated, elevation: 3 }, style]}>{children}</View>;
  }
  if (isLiquidGlassAvailable()) {
    return <GlassView glassEffectStyle="regular" style={[shape, style]}>{children}</GlassView>;
  }
  return (
    <View style={[shape, { shadowColor: "#000", shadowOpacity: mode === "dark" ? 0.4 : 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } }, style]}>
      <View style={[StyleSheet.absoluteFill, shape, { overflow: "hidden", borderWidth: hairline, borderColor: colors.glassEdge }]}>
        <BlurView tint={mode === "dark" ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"} intensity={80} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFill }]} />
      </View>
      {children}
    </View>
  );
}
