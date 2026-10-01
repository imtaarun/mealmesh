import { Text, View } from "react-native";
import { Button, TextLink } from "@/components/ui/Form";
import { useTheme } from "@/theme";

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function EmptyState({ message, actionLabel, onAction, secondaryLabel, onSecondary }: EmptyStateProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
      }}
    >
      <Text
        style={{
          ...typography.body,
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        {message}
      </Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
      {secondaryLabel && onSecondary ? <TextLink label={secondaryLabel} onPress={onSecondary} align="center" /> : null}
    </View>
  );
}
