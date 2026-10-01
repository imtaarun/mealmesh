import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Form";
import { CuisinePlaceholder } from "@/components/recipe/CuisinePlaceholder";
import { api, type Meal, type MealPlan } from "@/lib/api";
import { useTheme } from "@/theme";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Today's date as the plan stores it (YYYY-MM-DD), in the phone's own time zone. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HomeScreen() {
  const { colors, spacing, typography } = useTheme();
  const [plan, setPlan] = useState<MealPlan | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      api.getCurrentPlan(today()).then(setPlan);
    }, []),
  );

  const tonight: Meal | undefined = plan?.meals.find((m) => m.slot === "dinner" && m.date.slice(0, 10) === today());

  return (
    <Screen>
      <Text style={{ ...typography.display, color: colors.text, marginBottom: spacing.lg }}>{greeting(new Date().getHours())}</Text>

      {plan === undefined ? (
        <ActivityIndicator color={colors.primary} />
      ) : tonight?.recipe && tonight.type !== "eat_out" ? (
        <>
          <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>TONIGHT</Text>
          <Card style={{ gap: spacing.sm }}>
            <CuisinePlaceholder cuisine={tonight.recipe.cuisines[0] ?? "other"} />
            <Text style={{ ...typography.title, color: colors.text }}>
              {tonight.type === "leftover" ? `Leftovers · ${tonight.recipe.title}` : tonight.recipe.title}
            </Text>
            <Text style={{ ...typography.body, color: colors.textMuted }}>
              {tonight.recipe.prepMinutes + tonight.recipe.cookMinutes} min · {tonight.recipe.difficulty} · serves {tonight.servings}
            </Text>
            <Button label="Start cooking" onPress={() => router.push({ pathname: "/cook/[id]", params: { id: tonight.recipe!.id } })} />
            <Button
              label="View recipe"
              variant="outline"
              onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: tonight.recipe!.id, servings: String(tonight.servings) } })}
            />
          </Card>
        </>
      ) : tonight?.type === "eat_out" ? (
        <EmptyState message="You're eating out tonight. Enjoy the night off." actionLabel="See the week" onAction={() => router.push("/(tabs)/week")} />
      ) : plan ? (
        <EmptyState message="Nothing planned for tonight yet." actionLabel="Open the week" onAction={() => router.push("/(tabs)/week")} />
      ) : (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState message="Seven days. Zero decisions." actionLabel="Plan My Week" onAction={() => router.push("/(tabs)/week")} />
        </View>
      )}
    </Screen>
  );
}
