import { Text, View } from "react-native";
import { useTheme } from "@/theme";

/**
 * CLAUDE.md rule 2: all MVP pricing comes from MockGroceryProvider (approximate
 * pricing, not live retailer data — docs/open-questions.md item 1) and MUST render
 * with a visible "Estimated pricing" badge. Any screen that shows a price, total, or
 * savings figure renders this next to it — no exceptions, no "just this once".
 */
export function EstimatedPricingBadge() {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors.surfaceMuted,
        paddingVertical: spacing.xs / 2,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.pill,
      }}
    >
      <Text style={{ ...typography.label, color: colors.textMuted }}>ESTIMATED PRICING</Text>
    </View>
  );
}
