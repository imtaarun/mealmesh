import type { ComponentProps } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme";

/** An icon in a soft accent circle. */
export function IconBadge({ name, size = 40 }: { name: ComponentProps<typeof Ionicons>["name"]; size?: number }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: colors.accentTint, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={name} size={size / 2} color={colors.brandAccent} />
    </View>
  );
}
