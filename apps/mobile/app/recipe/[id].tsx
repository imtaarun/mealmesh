import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { formatQuantity, scaleQuantity, type Unit } from "@mealmesh/domain";
import { Screen, LoadingScreen, BackLink } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Button, Pill } from "@/components/ui/Form";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { CuisinePlaceholder } from "@/components/recipe/CuisinePlaceholder";
import { api, type RecipeDetail } from "@/lib/api";
import { dollars } from "@/lib/format";
import { useTheme } from "@/theme";

const label = (s: string) => s.replace(/_/g, " ");

export default function RecipeScreen() {
  const { colors, spacing, typography } = useTheme();
  const params = useLocalSearchParams<{ id: string; servings?: string; leftover?: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [servings, setServings] = useState<number | null>(params.servings ? Number(params.servings) : null);

  useEffect(() => {
    api.getRecipe(params.id).then((r) => {
      setRecipe(r);
      setServings((s) => s ?? r.servings);
    });
  }, [params.id]);

  if (!recipe || servings === null) {
    return <LoadingScreen />;
  }

  const have = new Set(recipe.pantryIngredientIds);
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
  const cook = () => router.push({ pathname: "/cook/[id]", params: { id: recipe.id, servings: String(servings) } });

  return (
    <Screen>
      <BackLink />

      {recipe.source === "seed" ? (
        <View style={{ marginBottom: spacing.md }}>
          <CuisinePlaceholder cuisine={recipe.cuisines[0] ?? "other"} />
        </View>
      ) : null}

      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.xs }}>{recipe.title}</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.sm }}>
        {totalMinutes} min ({recipe.prepMinutes} prep · {recipe.cookMinutes} cook) · {label(recipe.difficulty)} · {recipe.cuisines.map(label).join(", ")}
      </Text>
      {recipe.dietTags.length > 0 ? (
        <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.md }}>{recipe.dietTags.map(label).join(" · ")}</Text>
      ) : null}

      {params.leftover === "1" ? (
        <Card style={{ marginBottom: spacing.md, backgroundColor: colors.backgroundMuted }}>
          <Text style={{ ...typography.body, color: colors.text }}>These are leftovers from last night — just reheat and eat.</Text>
        </Card>
      ) : null}

      <Card style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ ...typography.bodyStrong, color: colors.text }}>Servings</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Pill label="−" variant="neutral" accessibilityLabel="Fewer servings" onPress={() => setServings(Math.max(1, servings - 1))} />
            <Text style={{ ...typography.heading, color: colors.text, minWidth: 24, textAlign: "center" }}>{servings}</Text>
            <Pill label="+" variant="neutral" accessibilityLabel="More servings" onPress={() => setServings(Math.min(20, servings + 1))} />
          </View>
        </View>
        {recipe.costPerServingCents !== null ? (
          <>
            <Text style={{ ...typography.body, color: colors.text }}>
              About {dollars(recipe.costPerServingCents)} a serving · {dollars(recipe.costPerServingCents * servings)} for {servings}
            </Text>
            {recipe.estimatedPricing ? <EstimatedPricingBadge /> : null}
          </>
        ) : (
          <Text style={{ ...typography.caption, color: colors.textMuted }}>We don't have prices for every ingredient yet.</Text>
        )}
      </Card>

      <Button label="Start cooking" onPress={cook} />

      <Text style={{ ...typography.heading, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }}>Ingredients</Text>
      <Card style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
        {recipe.ingredients.map((line) => (
          <View key={line.id} style={{ flexDirection: "row", gap: spacing.md }}>
            <Text style={{ ...typography.bodyStrong, color: colors.text, width: 92 }}>
              {formatQuantity(scaleQuantity(line.quantity, recipe.servings, servings), line.unit as Unit)}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.text }}>
                {line.ingredient.name}
                {line.note ? <Text style={{ color: colors.textMuted }}>, {line.note}</Text> : null}
                {line.optional ? <Text style={{ color: colors.textMuted }}> (optional)</Text> : null}
              </Text>
              {have.has(line.ingredientId) ? <Text style={{ ...typography.caption, color: colors.success }}>✓ In your pantry</Text> : null}
            </View>
          </View>
        ))}
      </Card>

      <Text style={{ ...typography.heading, color: colors.text, marginBottom: spacing.sm }}>Steps</Text>
      {recipe.instructions.map((step) => (
        <View key={step.step} style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ ...typography.heading, color: colors.brandAccent, width: 24 }}>{step.step}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.body, color: colors.text }}>{step.text}</Text>
            {step.timerSeconds ? (
              <Text style={{ ...typography.caption, color: colors.textMuted }}>⏱ {Math.round(step.timerSeconds / 60)} min</Text>
            ) : null}
          </View>
        </View>
      ))}
      <Button label="Start cooking" onPress={cook} />
    </Screen>
  );
}
