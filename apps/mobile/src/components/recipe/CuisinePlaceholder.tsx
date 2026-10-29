import { LinearGradient } from "expo-linear-gradient";
import { Text } from "react-native";
import { useTheme } from "@/theme";

interface CuisinePlaceholderProps {
  cuisine: string;
  height?: number;
  /** Set for a small square tile; leave out for a full-width banner. */
  size?: number;
}

export function CuisinePlaceholder({ cuisine, height = 140, size }: CuisinePlaceholderProps) {
  const { colors, radius } = useTheme();

  return (
    <LinearGradient
      colors={[colors.accentTint, colors.backgroundMuted]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        height: size ?? height,
        width: size,
        borderRadius: size ? radius.md : radius.lg,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size ? size * 0.4 : 40, fontWeight: "700", color: colors.brandAccent }}>{cuisine.charAt(0).toUpperCase()}</Text>
    </LinearGradient>
  );
}
