import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { formatQuantity, scaleQuantity, type Unit } from "@mealmesh/domain";
import { Screen, LoadingScreen, ErrorScreen, BackLink } from "@/components/ui/Screen";
import { Appear } from "@/components/ui/Motion";
import { useLoad } from "@/lib/useLoad";
import { haptic } from "@/lib/feedback";
import { Card } from "@/components/ui/Card";
import { Button, Pill } from "@/components/ui/Form";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { CuisinePlaceholder } from "@/components/recipe/CuisinePlaceholder";
import { api } from "@/lib/api";
import { dollars } from "@/lib/format";
import { useTheme } from "@/theme";

const label = (s: string) => s.replace(/_/g, " ");

export default function RecipeScreen() {
  const { colors, spacing, typography } = useTheme();
  const params = useLocalSearchParams<{ id: string; servings?: string; leftover?: string }>();
  const { data: recipe, error, reload } = useLoad(() => api.getRecipe(params.id), [params.id]);
  const [chosenServings, setServings] = useState<number | null>(params.servings ? Number(params.servings) : null);

  if (error && !recipe) return <ErrorScreen back="Back" message={error} onRetry={reload} />;
  if (!recipe) return <LoadingScreen back="Back" messages={["Scaling the ingredients…", "Checking your pantry…"]} />;
  const servings = chosenServings ?? recipe.servings;
  const changeServings = (next: number) => {
    haptic.tap();
    setServings(next);
  };

  const have = new Set(recipe.pantryIngredientIds);
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
  const cook = () => router.push({ pathname: "/cook/[id]", params: { id: recipe.id, servings: String(servings) } });

  return (
    <Screen>
      <BackLink />

      {recipe.source === "seed" ? (
        <Appear style={{ marginBottom: spacing.md }}>
          <CuisinePlaceholder cuisine={recipe.cuisines[0] ?? "other"} height={180} />
        </Appear>
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
            <Pill label="−" variant="neutral" accessibilityLabel="Fewer servings" onPress={() => changeServings(Math.max(1, servings - 1))} />
            <Text style={{ ...typography.heading, color: colors.text, minWidth: 24, textAlign: "center" }}>{servings}</Text>
            <Pill label="+" variant="neutral" accessibilityLabel="More servings" onPress={() => changeServings(Math.min(20, servings + 1))} />
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
