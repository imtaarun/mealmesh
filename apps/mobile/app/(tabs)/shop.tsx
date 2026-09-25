import { Text } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme";

// Shop — grocery list + optimization + Deal Radar (docs/product-spec.md). TODO(Phase
// 6/7): render list from GET /api/grocery-list?mealPlanId=, wire the three
// optimization strategies and Deal Radar once a plan exists.
export default function ShopScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Shop</Text>
      <EmptyState message="Your shopping list appears when your meals do." />
    </Screen>
  );
}
