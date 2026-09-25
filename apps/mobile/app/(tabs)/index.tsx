import { Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme";

// Home — docs/ux.md "Home screen tells a story": today's meal, week summary, smart
// suggestions. Every suggestion must be backed by a real computed number — never
// rendered until the backend has an actual meal plan, pantry, and deals to compute
// from (Phase 4+). Until then this is the empty state, not a fake preview.
export default function HomeScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <Screen>
      <Text style={{ ...typography.display, color: colors.text, marginBottom: spacing.lg }}>
        Good afternoon
      </Text>
      <View style={{ marginTop: spacing.xl }}>
        <EmptyState
          message="Seven days. Zero decisions."
          actionLabel="Plan My Week"
          onAction={() => router.push("/(tabs)/week")}
        />
      </View>
    </Screen>
  );
}
