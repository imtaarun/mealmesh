import { Text } from "react-native";
import { PressableScale } from "./PressableScale";
import { useTheme } from "@/theme";

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors, spacing, radius, typography, minTouch, hairline } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityState={{ selected }}
      style={{
        minHeight: minTouch,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: selected ? 0 : hairline,
        borderColor: colors.border,
        backgroundColor: selected ? colors.brandAccent : colors.surfaceElevated,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={{ ...typography.caption, color: selected ? colors.onBrandAccent : colors.text }}>{label}</Text>
    </PressableScale>
  );
}
