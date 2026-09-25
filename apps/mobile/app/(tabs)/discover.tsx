import { Text } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme";

// Discover — recipes and ideas. Deliberately thin in the MVP (docs/ux.md
// "Navigation") — do not build this out before the planner/list/optimizer spine works.
export default function DiscoverScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Discover</Text>
      <EmptyState message="Recipe browsing is coming after the core planning flow." />
    </Screen>
  );
}
