import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";
import { useTheme } from "@/theme";

const CUISINE_GRADIENTS: Record<string, [string, string]> = {
  indian: ["#E0A93B", "#C1622A"],
  mediterranean: ["#5C7A5E", "#8FAE8A"],
  north_american: ["#C1622A", "#9C4C1F"],
  italian: ["#83A385", "#5C7A5E"],
  mexican: ["#E0895A", "#C1622A"],
  middle_eastern: ["#D9A441", "#9C4C1F"],
  chinese: ["#C1622A", "#7A2E1D"],
  thai: ["#5C7A5E", "#3E5940"],
  japanese: ["#8A7F76", "#5C5049"],
  french: ["#8FAE8A", "#5C7A5E"],
  korean: ["#E0895A", "#9C4C1F"],
  caribbean: ["#E0A93B", "#5C7A5E"],
};

const DEFAULT_GRADIENT: [string, string] = ["#8A7F76", "#5C5049"];

function cuisineInitial(cuisine: string): string {
  return cuisine.replace(/_/g, " ").charAt(0).toUpperCase();
}

interface CuisinePlaceholderProps {
  cuisine: string;
  height?: number;
}

export function CuisinePlaceholder({ cuisine, height = 140 }: CuisinePlaceholderProps) {
  const { radius } = useTheme();
  const colors = CUISINE_GRADIENTS[cuisine] ?? DEFAULT_GRADIENT;

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        height,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ opacity: 0.85 }}>
        <Text style={{ fontSize: 40, fontWeight: "700", color: "rgba(255,255,255,0.9)" }}>{cuisineInitial(cuisine)}</Text>
      </View>
    </LinearGradient>
  );
}
