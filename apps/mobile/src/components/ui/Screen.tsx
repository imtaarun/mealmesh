import type { PropsWithChildren } from "react";
import { ScrollView, View, type ViewProps } from "react-native";
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
