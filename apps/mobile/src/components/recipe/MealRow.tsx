import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui/Card";
import { CuisinePlaceholder } from "./CuisinePlaceholder";
import { useTheme } from "@/theme";
import type { Meal } from "@/lib/api";

interface MealRowProps {
  meal: Meal;
  /** Dinner is the day's main row; other slots show smaller and label their slot. */
  main: boolean;
  onPress: () => void;
  onMenu: () => void;
}

/** One planned meal: tap opens it, ⋯ or long-press opens its actions. */
export function MealRow({ meal, main, onPress, onMenu }: MealRowProps) {
  const { colors, spacing, typography, minTouch } = useTheme();
  const { recipe } = meal;
  const tile = main ? 64 : 44;

  return (
    <Card onPress={onPress} onLongPress={onMenu} style={{ flexDirection: "row", alignItems: "center", gap: spacing.smd, padding: spacing.sm, paddingRight: 0 }}>
      {recipe ? (
        <CuisinePlaceholder cuisine={recipe.cuisines[0] ?? "other"} size={tile} />
      ) : (
        <View style={{ width: tile, height: tile, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.textMuted, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={meal.type === "eat_out" ? "restaurant-outline" : "add"} size={22} color={colors.textMuted} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        {!main ? <Text style={{ ...typography.label, color: colors.textMuted }}>{meal.slot.toUpperCase()}</Text> : null}
        {recipe ? (
          <>
            <Text style={{ ...typography.heading, color: colors.text }} numberOfLines={2}>
              {meal.type === "leftover" ? `Leftovers · ${recipe.title}` : recipe.title}
            </Text>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              {meal.type === "leftover" ? "Just reheat" : `${recipe.prepMinutes + recipe.cookMinutes} min · ${recipe.difficulty}`}
            </Text>
          </>
        ) : (
          <Text style={{ ...typography.heading, color: colors.textMuted }}>{meal.type === "eat_out" ? "Eating out" : `Add ${meal.slot}`}</Text>
        )}
      </View>

      {recipe || meal.type === "eat_out" ? (
        <Pressable
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel={`${meal.slot} options`}
          style={{ width: minTouch, height: minTouch, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Card>
  );
}
