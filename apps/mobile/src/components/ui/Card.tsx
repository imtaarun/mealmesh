import type { PropsWithChildren } from "react";
import { Pressable, View, type ViewProps } from "react-native";
import { useTheme } from "@/theme";

interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  style?: ViewProps["style"];
}

export function Card({ children, onPress, style }: CardProps) {
  const { colors, spacing, radius } = useTheme();
  const baseStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [baseStyle, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
}
