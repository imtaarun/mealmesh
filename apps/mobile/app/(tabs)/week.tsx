import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, LoadingScreen, ErrorScreen } from "@/components/ui/Screen";
import { LoadingState } from "@/components/ui/States";
import { Appear } from "@/components/ui/Motion";
import { attempt } from "@/components/ui/Toast";
import { haptic } from "@/lib/feedback";
import { useLoad } from "@/lib/useLoad";
import { loadWeekCost, sharesOf } from "@/lib/weekCost";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Pill, TextLink } from "@/components/ui/Form";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { dollars } from "@/lib/format";
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

export default function WeekScreen() {
  const { colors, spacing, typography, minTouch } = useTheme();
  const { data, setData, error, reload } = useLoad(async () => {
    const [plan, me, members] = await Promise.all([api.getCurrentPlan(), api.getMe(), api.getMembers()]);
    return { plan, me, members };
  });
  const [creating, setCreating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planFailed, setPlanFailed] = useState(false);
  const [repickingId, setRepickingId] = useState<string | null>(null);
  const [weekCents, setWeekCents] = useState<number | null>(null);
  const plan = data?.plan;
  const setPlan = (next: MealPlan) => setData((d) => d && { ...d, plan: next });
  const isPro = data?.me.household.subscriptionTier === "pro";

  // Re-priced whenever the plan changes; the same Best overall figure Shop shows.
  useEffect(() => {
    let current = true;
    if (plan) loadWeekCost(plan.id).then((cents) => current && setWeekCents(cents), () => current && setWeekCents(null));
    return () => {
      current = false;
    };
  }, [plan]);

  async function buildWeek() {
    setCreating(true);
    const created = await attempt(() => api.createEmptyWeek(isoDate(mostRecentMonday())));
    if (created) setPlan(created);
    setCreating(false);
  }

  async function planMyWeek() {
    setPlanning(true);
    setPlanFailed(false);
    try {
      setPlan(await api.planMyWeek(isoDate(mostRecentMonday())));
      haptic.success();
    } catch {
      haptic.warning();
      setPlanFailed(true); // its own screen: "Meal planning took a wrong turn" (docs/ux.md)
    } finally {
      setPlanning(false);
    }
  }

  async function repick(meal: Meal) {
    if (!plan) return;
    setRepickingId(meal.id);
    const updated = await attempt(() => api.regenerateDinner(plan.id, meal.id));
    if (updated) {
      haptic.success();
      setPlan(updated);
    }
    setRepickingId(null);
  }

  async function skip(meal: Meal) {
    if (!plan) return;
    const updated = await attempt(() => api.skipMealSlot(plan.id, meal.id));
    if (!updated) return;
    haptic.tap();
    setPlan({ ...plan, meals: plan.meals.map((m) => (m.id === meal.id ? updated : m)) });
  }

  if (error && !data) return <ErrorScreen title="Week" message={error} onRetry={reload} />;
  if (!data) return <LoadingScreen title="Week" messages={["Opening your week…"]} />;

  if (planning) {
    return (
      <Screen>
        <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Week</Text>
        <LoadingState messages={["Balancing your week…", "Finding ways to use leftovers…", "Comparing your ingredients…", "Looking for better-value options…"]} />
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

  if (!plan) {
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
  // With housemates, your part of the same figure the card shows.
  const housemates = data.members.members;
  const yourShare = weekCents && housemates.length > 1 ? sharesOf(weekCents, housemates)?.[housemates.find((m) => m.isYou)!.id] : undefined;

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
        <Text style={{ ...typography.title, color: colors.text }}>Week</Text>
        {isPro ? (
          <TextLink label="Plan My Week" onPress={planMyWeek} />
        ) : null}
      </View>

      {mealsPlanned > 0 ? (
        <Appear>
          <Card style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
            <Text style={{ ...typography.bodyStrong, color: colors.text }}>
              {mealsPlanned} meals planned{weekCents ? ` · ${dollars(weekCents, 0)} estimated` : ""}
              {plan.score ? ` · ${plan.score.total}/100` : ""}
            </Text>
            {yourShare !== undefined ? (
              <Text style={{ ...typography.body, color: colors.text }}>
                Your share: {dollars(yourShare)} of {housemates.length} people
              </Text>
            ) : null}
            {weekCents ? <EstimatedPricingBadge /> : null}
            {plan.score ? <Text style={{ ...typography.caption, color: colors.textMuted }}>{plan.score.explanation}</Text> : null}
          </Card>
        </Appear>
      ) : null}

      {dates.map((date, dayIndex) => (
        <Appear key={date} index={dayIndex + 1} style={{ marginBottom: spacing.lg }}>
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
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/recipe/[id]",
                            params: { id: meal.recipe!.id, servings: String(meal.servings), ...(meal.type === "leftover" ? { leftover: "1" } : {}) },
                          })
                        }
                        accessibilityRole="link"
                        style={{ minHeight: minTouch, justifyContent: "center" }}
                      >
                        <Text style={{ ...typography.bodyStrong, color: colors.text }} numberOfLines={1}>
                          {meal.type === "leftover" ? `Leftovers · ${meal.recipe.title}` : meal.recipe.title}
                        </Text>
                        <Text style={{ ...typography.caption, color: colors.brandAccent }}>
                          {meal.type === "leftover" ? "View recipe ›" : `${meal.recipe.prepMinutes + meal.recipe.cookMinutes} min · View recipe ›`}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={{ ...typography.body, color: colors.textMuted }}>Nothing picked yet</Text>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
                    {isPro && meal.slot === "dinner" && meal.type === "cook" ? (
                      <Pill label={repickingId === meal.id ? "Picking…" : "New pick"} onPress={() => repick(meal)} disabled={repickingId !== null} />
                    ) : null}
                    <Pill
                      label={meal.recipe ? "Change" : "Add"}
                      accessibilityLabel={`${meal.recipe ? "Change" : "Add"} ${slot}`}
                      onPress={() => router.push({ pathname: "/recipe-picker", params: { mealPlanId: plan.id, mealId: meal.id } })}
                    />
                    {meal.recipe ? <Pill label="Skip" variant="neutral" accessibilityLabel={`Skip ${slot}`} onPress={() => skip(meal)} /> : null}
                  </View>
                </View>
              </Card>
            );
          })}
        </Appear>
      ))}
    </Screen>
  );
}
