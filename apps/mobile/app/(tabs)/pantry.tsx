import { Text } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme";

// TODO(Phase 6): pantry CRUD and Use It First.
export default function PantryScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Pantry</Text>
      <EmptyState
        message="Your pantry is looking suspiciously empty."
        actionLabel="Add items"
        onAction={() => {
          // TODO(Phase 6): open add-item flow
        }}
      />
    </Screen>
  );
}
