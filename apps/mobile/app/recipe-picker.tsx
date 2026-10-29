import { useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { RecipeBrowser } from "@/components/recipe/RecipeBrowser";
import { api, type MealSlot, type RecipeSummary } from "@/lib/api";
import { messageOf } from "@/lib/useLoad";

export default function RecipePickerScreen() {
  const { mealPlanId, mealId, slot } = useLocalSearchParams<{ mealPlanId: string; mealId: string; slot?: MealSlot }>();

  const [selecting, setSelecting] = useState(false);

  async function pick(recipe: RecipeSummary, acknowledgeWarnings = false) {
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
      Alert.alert("Couldn't add this meal", messageOf(err));
    } finally {
      setSelecting(false);
    }
  }

  return <RecipeBrowser title="Pick a dish" initialSlot={slot ?? null} onPick={(recipe) => !selecting && pick(recipe)} />;
}
