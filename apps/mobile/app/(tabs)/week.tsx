import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { useTheme } from "@/theme";
import { api, type Household, type Meal, type MealPlan, type MealSlot } from "@/lib/api";

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

// The week grid. Free and Pro both get Build My Week (pick each slot by hand); Pro
// also gets Plan My Week, which fills dinners and leftover lunches in one tap and can
// re-pick a single dinner (docs/product-spec.md, docs/ux.md "Empty states").
export default function WeekScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const [plan, setPlan] = useState<MealPlan | null | undefined>(undefined); // undefined = loading
  const [household, setHousehold] = useState<Household | null>(null);
  const [creating, setCreating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planFailed, setPlanFailed] = useState(false);
  const [repickingId, setRepickingId] = useState<string | null>(null);
  const isPro = household?.subscriptionTier === "pro";

  const load = useCallback(() => {
    api.getCurrentPlan().then(setPlan);
    api.getHousehold().then(setHousehold);
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

  async function planMyWeek() {
    setPlanning(true);
    setPlanFailed(false);
    try {
      setPlan(await api.planMyWeek(isoDate(mostRecentMonday())));
    } catch {
      setPlanFailed(true);
    } finally {
      setPlanning(false);
    }
  }

  async function repick(meal: Meal) {
    if (!plan) return;
    setRepickingId(meal.id);
    try {
      setPlan(await api.regenerateDinner(plan.id, meal.id));
    } finally {
      setRepickingId(null);
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

  if (planning) {
    return (
      <Screen>
        <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Week</Text>
        <View style={{ alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.md }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ ...typography.body, color: colors.textMuted }}>Balancing your week…</Text>
        </View>
      </Screen>
    );
  }

  if (planFailed) {
    return (
      <Screen>
        <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Week</Text>
        <EmptyState message="Meal planning took a wrong turn. Let's try again." actionLabel="Try again" onAction={planMyWeek} />
      </Screen>
    );
  }

  if (plan === null) {
    return (
      <Screen>
        <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Week</Text>
        {isPro ? (
          <EmptyState
            message="Seven days. Zero decisions."
            actionLabel="Plan My Week"
            onAction={planMyWeek}
            secondaryLabel={creating ? "Building…" : "Build it myself"}
            onSecondary={creating ? () => {} : buildWeek}
          />
        ) : (
          <EmptyState
            message="Seven days. Zero decisions."
            actionLabel={creating ? "Building…" : "Build My Week"}
            onAction={creating ? () => {} : buildWeek}
          />
        )}
      </Screen>
    );
  }

  const mealsByDate = new Map<string, Meal[]>();
  for (const meal of plan.meals) {
    const key = meal.date.slice(0, 10);
    mealsByDate.set(key, [...(mealsByDate.get(key) ?? []), meal]);
  }
  const dates = [...mealsByDate.keys()].sort();
  const mealsPlanned = plan.meals.filter((m) => m.type === "cook" || m.type === "leftover").length;

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
        <Text style={{ ...typography.title, color: colors.text }}>Week</Text>
        {isPro ? (
          <Pressable onPress={planMyWeek} hitSlop={8}>
            <Text style={{ ...typography.caption, color: colors.primary }}>Plan My Week</Text>
          </Pressable>
        ) : null}
      </View>

      {plan.score && plan.estimatedCostCents !== null ? (
        <Card style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
          <Text style={{ ...typography.bodyStrong, color: colors.text }}>
            {mealsPlanned} meals planned · ${(plan.estimatedCostCents / 100).toFixed(0)} estimated · {plan.score.total}/100
          </Text>
          <EstimatedPricingBadge />
          <Text style={{ ...typography.caption, color: colors.textMuted }}>{plan.score.explanation}</Text>
        </Card>
      ) : null}

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
                {/* A picked meal has room for its full name, with its actions on a row below;
                    an empty slot keeps its single Add button inline. */}
                <View
                  style={
                    meal.recipe
                      ? { gap: spacing.sm }
                      : { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }
                  }
                >
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ ...typography.label, color: colors.textMuted }}>{slot.toUpperCase()}</Text>
                    {meal.type === "eat_out" ? (
                      <Text style={{ ...typography.body, color: colors.textMuted }}>Eating out</Text>
                    ) : meal.recipe ? (
                      <Text style={{ ...typography.bodyStrong, color: colors.text }} numberOfLines={1}>
                        {meal.type === "leftover" ? `Leftovers · ${meal.recipe.title}` : meal.recipe.title}
                      </Text>
                    ) : (
                      <Text style={{ ...typography.body, color: colors.textMuted }}>Nothing picked yet</Text>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
                    {isPro && meal.slot === "dinner" && meal.type === "cook" ? (
                      <Pressable
                        onPress={() => repick(meal)}
                        disabled={repickingId !== null}
                        style={{
                          paddingVertical: spacing.xs,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.pill,
                          borderWidth: 1,
                          borderColor: colors.primary,
                        }}
                      >
                        <Text style={{ ...typography.caption, color: colors.primary }}>
                          {repickingId === meal.id ? "Picking…" : "New pick"}
                        </Text>
                      </Pressable>
                    ) : null}
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
