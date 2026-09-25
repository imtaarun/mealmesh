import { Text } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme";

// Pantry — fridge / freezer / pantry, "Use It First" (docs/product-spec.md
// "Pantry"). TODO(Phase 6): CRUD against GET/POST/PATCH /api/pantry(/items).
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
