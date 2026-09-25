import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/theme";
import { api, type Meal, type MealPlan, type MealSlot } from "@/lib/api";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mostRecentMonday(): Date {
  const today = new Date();
  const day = today.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + diff));
  return monday;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Build My Week — docs/product-spec.md. Free and Pro both build the week by hand,
// slot by slot; there is no AI in this screen at all (Plan My Week, the Pro
// auto-generate shortcut, is a separate not-yet-built entry point per
// docs/architecture.md "Meal plan generation").
export default function WeekScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const [plan, setPlan] = useState<MealPlan | null | undefined>(undefined); // undefined = loading
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api.getCurrentPlan().then(setPlan);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function buildWeek() {
    setCreating(true);
    try {
      const created = await api.createEmptyWeek(isoDate(mostRecentMonday()));
      setPlan(created);
    } finally {
      setCreating(false);
    }
  }

  async function skip(meal: Meal) {
    if (!plan) return;
    const updated = await api.skipMealSlot(plan.id, meal.id);
    setPlan({ ...plan, meals: plan.meals.map((m) => (m.id === meal.id ? updated : m)) });
  }

  if (plan === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (plan === null) {
    return (
      <Screen>
        <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Week</Text>
        <EmptyState
          message="Seven days. Zero decisions."
          actionLabel={creating ? "Building…" : "Build My Week"}
          onAction={creating ? () => {} : buildWeek}
        />
      </Screen>
    );
  }

  const mealsByDate = new Map<string, Meal[]>();
  for (const meal of plan.meals) {
    const key = meal.date.slice(0, 10);
    mealsByDate.set(key, [...(mealsByDate.get(key) ?? []), meal]);
  }
  const dates = [...mealsByDate.keys()].sort();

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.lg }}>Week</Text>

      {dates.map((date, dayIndex) => (
        <View key={date} style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...typography.bodyStrong, color: colors.textMuted, marginBottom: spacing.sm }}>
            {DAY_LABELS[dayIndex] ?? date} · {date}
          </Text>

          {SLOTS.map((slot) => {
            const meal = mealsByDate.get(date)?.find((m) => m.slot === slot);
            if (!meal) return null;

            return (
              <Card key={meal.id} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.label, color: colors.textMuted }}>{slot.toUpperCase()}</Text>
                    {meal.recipe ? (
                      <Text style={{ ...typography.bodyStrong, color: colors.text }} numberOfLines={1}>
                        {meal.recipe.title}
                      </Text>
                    ) : (
                      <Text style={{ ...typography.body, color: colors.textMuted }}>Nothing picked yet</Text>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Pressable
                      onPress={() => router.push({ pathname: "/recipe-picker", params: { mealPlanId: plan.id, mealId: meal.id } })}
                      style={{
                        paddingVertical: spacing.xs,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.pill,
                        backgroundColor: colors.primary,
                      }}
                    >
                      <Text style={{ ...typography.caption, color: colors.background }}>
                        {meal.recipe ? "Change" : "Add"}
                      </Text>
                    </Pressable>
                    {meal.recipe ? (
                      <Pressable
                        onPress={() => skip(meal)}
                        style={{
                          paddingVertical: spacing.xs,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.pill,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ ...typography.caption, color: colors.textMuted }}>Skip</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
