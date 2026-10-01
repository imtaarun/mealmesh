import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/theme";

// Liquid Glass for the control layer only (tab bar, floating controls) — never on content.
// Android gets a Material tonal surface instead.
export function Glass({ children, style }: PropsWithChildren<{ style?: ViewProps["style"] }>) {
  const { colors, radius, hairline, mode } = useTheme();
  const shape = { borderRadius: radius.pill, borderCurve: "continuous" as const };

  if (Platform.OS === "android") {
    return <View style={[shape, { backgroundColor: colors.surfaceElevated, elevation: 3 }, style]}>{children}</View>;
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
