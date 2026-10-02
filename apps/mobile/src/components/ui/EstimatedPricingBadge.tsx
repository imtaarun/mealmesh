import { Text, View } from "react-native";
import { useTheme } from "@/theme";

/** Required next to every price, total, or saving (CLAUDE.md rule 2). */
export function EstimatedPricingBadge() {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors.backgroundMuted,
        paddingVertical: spacing.xs / 2,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.pill,
      }}
    >
      <Text style={{ ...typography.label, color: colors.textMuted }}>ESTIMATED PRICING</Text>
    </View>
  );
}
