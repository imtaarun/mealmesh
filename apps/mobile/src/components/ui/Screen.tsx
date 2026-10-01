import type { PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, type ViewProps } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme";

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  style?: ViewProps["style"];
}

/** Base screen wrapper: safe-area, theme background, consistent horizontal padding. */
export function Screen({ children, scroll = true, style }: ScreenProps) {
  const { colors, spacing } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          style={style}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: spacing.lg }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function BackLink({ label = "Back" }: { label?: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginBottom: spacing.md }}>
      <Text style={{ ...typography.caption, color: colors.primary }}>‹ {label}</Text>
    </Pressable>
  );
}

export function LoadingScreen({ back }: { back?: string }) {
  const { colors } = useTheme();
  return (
    <Screen>
      {back ? <BackLink label={back} /> : null}
      <ActivityIndicator color={colors.primary} />
    </Screen>
  );
}
