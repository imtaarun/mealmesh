import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { MealCard } from "@/components/recipe/MealCard";
import { useTheme } from "@/theme";
import { api, type Recipe } from "@/lib/api";
import { ApiError } from "@/lib/api-client";

const CUISINE_FILTERS = ["indian", "mediterranean", "north_american"];

export default function RecipePickerScreen() {
  const { colors, spacing, typography } = useTheme();
  const { mealPlanId, mealId } = useLocalSearchParams<{ mealPlanId: string; mealId: string }>();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .listRecipes(cuisine ? { cuisine } : {})
      .then(setRecipes)
      .finally(() => setLoading(false));
  }, [cuisine]);

  async function pick(recipe: Recipe, acknowledgeWarnings = false) {
    if (!mealPlanId || !mealId) return;
    setSelecting(true);
    try {
      const result = await api.setMealSlot(mealPlanId, mealId, recipe.id, acknowledgeWarnings);

      if (result.conflict?.blocked) {
        Alert.alert(
          "Can't add this one",
          `${recipe.title} contains something you're allergic to. Pick something else.`,
        );
        return;
      }

      if (result.conflict && result.conflict.warnings.length > 0 && !acknowledgeWarnings) {
        Alert.alert(
          "Just checking",
          `${recipe.title} contains something you usually don't like. Add it anyway?`,
          [
            { text: "Pick something else", style: "cancel" },
            { text: "Add anyway", onPress: () => pick(recipe, true) },
          ],
        );
        return;
      }

      router.back();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong — try again.";
      Alert.alert("Couldn't add this meal", message);
    } finally {
      setSelecting(false);
    }
  }

  return (
    <Screen scroll={false}>
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Pick a dish</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.md }}>
        <Chip label="All" selected={cuisine === null} onPress={() => setCuisine(null)} />
        {CUISINE_FILTERS.map((c) => (
          <Chip key={c} label={c.replace(/_/g, " ")} selected={cuisine === c} onPress={() => setCuisine(c)} />
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : recipes.length === 0 ? (
        <EmptyState message="No recipes match that filter yet." />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => <MealCard recipe={item} onPress={() => !selecting && pick(item)} />}
        />
      )}
    </Screen>
  );
}
