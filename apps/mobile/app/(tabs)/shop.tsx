import { Text } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme";

// TODO(Phases 6–7): grocery list, optimization, Deal Radar.
export default function ShopScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Shop</Text>
      <EmptyState message="Your shopping list appears when your meals do." />
    </Screen>
  );
}
