import { Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { CuisinePlaceholder } from "./CuisinePlaceholder";
import { useTheme } from "@/theme";
import type { Recipe } from "@/lib/api";

interface MealCardProps {
  recipe: Recipe;
  onPress?: () => void;
}

/**
 * Two deliberately different treatments (docs/ux.md "Recipe imagery"): local-library
 * recipes get the per-cuisine placeholder image; AI-generated recipes get no image at
 * all and a denser, text-forward layout instead — the absence is the honest signal,
 * not something to paper over with a lookalike placeholder.
 */
export function MealCard({ recipe, onPress }: MealCardProps) {
  const { colors, spacing, typography } = useTheme();
  const isLibraryRecipe = recipe.source === "seed";

  return (
    <Card onPress={onPress}>
      {isLibraryRecipe ? (
        <View style={{ marginBottom: spacing.sm }}>
          <CuisinePlaceholder cuisine={recipe.cuisines[0] ?? "other"} />
        </View>
      ) : (
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: colors.surfaceMuted,
            paddingVertical: 2,
            paddingHorizontal: spacing.sm,
            borderRadius: 999,
            marginBottom: spacing.sm,
          }}
        >
          <Text style={{ ...typography.label, color: colors.textMuted }}>CUSTOM RECIPE</Text>
        </View>
      )}

      <Text style={{ ...typography.heading, color: colors.text }} numberOfLines={2}>
        {recipe.title}
      </Text>
      <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs / 2 }}>
        {recipe.prepMinutes + recipe.cookMinutes} min · {recipe.difficulty}
      </Text>

      {recipe.dietTags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm }}>
          {recipe.dietTags.slice(0, 3).map((tag) => (
            <View
              key={tag}
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: 999,
                paddingVertical: 2,
                paddingHorizontal: spacing.sm,
                marginRight: spacing.xs,
                marginBottom: spacing.xs,
              }}
            >
              <Text style={{ ...typography.label, color: colors.textMuted }}>{tag.replace(/_/g, " ")}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
