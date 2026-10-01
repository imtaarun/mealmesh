import { useContext, type PropsWithChildren } from "react";
import { ActivityIndicator, ScrollView, View, type ViewProps } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { TextLink } from "@/components/ui/Form";
import { useTheme } from "@/theme";

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  style?: ViewProps["style"];
}

export function Screen({ children, scroll = true, style }: ScreenProps) {
  const { colors, spacing } = useTheme();
  // The tab bar floats over content (it's translucent on iOS), so leave room for it.
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

  return (
    <SafeAreaView edges={tabBarHeight ? ["top", "left", "right"] : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          style={style}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + tabBarHeight }}
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
  return <TextLink label={`‹ ${label}`} onPress={() => router.back()} />;
}

export function LoadingScreen({ back }: { back?: string }) {
  const { colors } = useTheme();
  return (
    <Screen>
      {back ? <BackLink label={back} /> : null}
      <ActivityIndicator color={colors.brandAccent} />
    </Screen>
  );
}
