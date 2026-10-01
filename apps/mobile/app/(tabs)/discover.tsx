import { Text } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme";

// Deliberately thin in the MVP.
export default function DiscoverScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Discover</Text>
      <EmptyState message="Recipe browsing is coming after the core planning flow." />
    </Screen>
  );
}
