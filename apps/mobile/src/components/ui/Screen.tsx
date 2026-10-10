import { useContext, type PropsWithChildren } from "react";
import { ScrollView, Text, View, type ViewProps } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { TextLink } from "@/components/ui/Form";
import { ErrorState, LoadingState } from "@/components/ui/States";
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

function Title({ back, title }: { back?: string; title?: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <>
      {back ? <BackLink label={back} /> : null}
      {title ? <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>{title}</Text> : null}
    </>
  );
}

export function LoadingScreen({ back, title, messages }: { back?: string; title?: string; messages?: string[] }) {
  return (
    <Screen>
      <Title back={back} title={title} />
      <LoadingState messages={messages} />
    </Screen>
  );
}

export function ErrorScreen({ back, title, message, onRetry }: { back?: string; title?: string; message: string; onRetry: () => void }) {
  return (
    <Screen>
      <Title back={back} title={title} />
      <ErrorState message={message} onRetry={onRetry} />
    </Screen>
  );
}
