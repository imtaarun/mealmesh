import { Pressable, Text, useColorScheme, View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { palettes, radius, spacing, typography } from "@/theme";

/** Last line of defence when a screen throws. Reads colours directly: the theme may be what broke. */
export function CrashScreen({ retry }: ErrorBoundaryProps) {
  const colors = palettes.forest[useColorScheme() === "dark" ? "dark" : "light"];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: spacing.lg, gap: spacing.md }}>
      <Text style={{ ...typography.title, color: colors.text }}>Something went sideways.</Text>
      <Text style={{ ...typography.body, color: colors.textMuted }}>Your plan, list and pantry are safe. Let's reload this screen.</Text>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        style={{ backgroundColor: colors.brandAccent, borderRadius: radius.pill, minHeight: 52, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ ...typography.bodyStrong, color: colors.onBrandAccent }}>Try again</Text>
      </Pressable>
    </View>
  );
}
