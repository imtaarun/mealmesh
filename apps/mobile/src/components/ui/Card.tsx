import type { PropsWithChildren } from "react";
import { View, type ViewProps } from "react-native";
import { PressableScale } from "./PressableScale";
import { useTheme } from "@/theme";

interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  style?: ViewProps["style"];
}

export function Card({ children, onPress, style }: CardProps) {
  const { colors, spacing, radius, hairline } = useTheme();
  const base = {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderCurve: "continuous" as const,
    borderWidth: hairline,
    borderColor: colors.border,
    padding: spacing.md,
  };

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={[base, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
