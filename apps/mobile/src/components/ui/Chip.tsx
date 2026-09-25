import { Pressable, Text } from "react-native";
import { useTheme } from "@/theme";

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** Toggleable pill button — used for the multi-select preference groups in onboarding. */
export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : colors.surface,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={{ ...typography.caption, color: selected ? colors.background : colors.text }}>{label}</Text>
    </Pressable>
  );
}
