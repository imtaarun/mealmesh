import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme";

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** A smaller text link under the main action — e.g. Pro's "Build it myself". */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * Empty states do work, not just say "Loading…" or "No data" — docs/ux.md "Empty
 * states". Callers pass the exact copy from that doc; this component only handles
 * layout.
 */
export function EmptyState({ message, actionLabel, onAction, secondaryLabel, onSecondary }: EmptyStateProps) {
  const { colors, spacing, radius, typography } = useTheme();

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
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.pill,
          })}
        >
          <Text style={{ ...typography.bodyStrong, color: colors.background }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Pressable onPress={onSecondary} hitSlop={8}>
          <Text style={{ ...typography.caption, color: colors.primary }}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
