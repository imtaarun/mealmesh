import { Text } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme";

// Profile — preferences, household, budget, stores (docs/ux.md "Navigation").
// TODO(Phase 1): build the onboarding flow (docs/product-spec.md "Onboarding +
// preferences") and surface it for editing here.
export default function ProfileScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Profile</Text>
      <EmptyState message="Set up your household and preferences to get started." actionLabel="Get started" />
    </Screen>
  );
}
