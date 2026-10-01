import { LinearGradient } from "expo-linear-gradient";
import { Text } from "react-native";
import { useTheme } from "@/theme";

interface CuisinePlaceholderProps {
  cuisine: string;
  height?: number;
}

export function CuisinePlaceholder({ cuisine, height = 140 }: CuisinePlaceholderProps) {
  const { colors, radius } = useTheme();

  return (
    <LinearGradient
      colors={[colors.accentTint, colors.backgroundMuted]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ height, borderRadius: radius.lg, borderCurve: "continuous", alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 40, fontWeight: "700", color: colors.brandAccent }}>{cuisine.charAt(0).toUpperCase()}</Text>
    </LinearGradient>
  );
}
