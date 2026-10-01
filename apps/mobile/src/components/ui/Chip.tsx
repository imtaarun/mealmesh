import { Text } from "react-native";
import { PressableScale } from "./PressableScale";
import { useTheme } from "@/theme";

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors, spacing, radius, typography, minTouch } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        minHeight: minTouch,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.accentTint : colors.backgroundMuted,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={{ ...typography.caption, color: selected ? colors.brandAccent : colors.text, fontWeight: selected ? "600" : "500" }}>{selected ? `✓ ${label}` : label}</Text>
    </PressableScale>
  );
}
