import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen, LoadingScreen, ErrorScreen } from "@/components/ui/Screen";
import { LoadingState } from "@/components/ui/States";
import { Appear } from "@/components/ui/Motion";
import { reportError } from "@/components/ui/Toast";
import { haptic } from "@/lib/feedback";
import { messageOf } from "@/lib/useLoad";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Pill, TextLink } from "@/components/ui/Form";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { dollars } from "@/lib/format";
import { useTheme } from "@/theme";
import { api, type Me, type Meal, type MealPlan, type MealSlot, type Members } from "@/lib/api";

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
  const [plan, setPlan] = useState<MealPlan | null | undefined>(undefined); // undefined = loading
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Members | null>(null);
  const [creating, setCreating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planFailed, setPlanFailed] = useState(false);
  const [repickingId, setRepickingId] = useState<string | null>(null);
  const [weekCents, setWeekCents] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isPro = me?.household.subscriptionTier === "pro";

  // Same figure as Shop's budget: what Best overall would cost (open-questions item 27).
  // Housemates' shares are worked out from that figure, so they load after it.
  const refreshCost = (planId: string) =>
    api
      .getGroceryList(planId)
      .then((list) => api.optimizeGroceryList(list.id))
      .then((o) => setWeekCents(o.budget.plannedCents), () => setWeekCents(null))
      .then(() => api.getMembers().then(setMembers, () => {}));

  const load = useCallback(() => {
    setLoadError(null);
    api.getCurrentPlan().then((p) => {
      setPlan(p);
      if (p) refreshCost(p.id);
    }, (err) => setLoadError(messageOf(err)));
    api.getMe().then(setMe, () => {});
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
    } catch (err) {
      reportError(err);
    } finally {
      setCreating(false);
    }
  }

  async function planMyWeek() {
    setPlanning(true);
    setPlanFailed(false);
    try {
      const planned = await api.planMyWeek(isoDate(mostRecentMonday()));
      haptic.success();
      setPlan(planned);
      refreshCost(planned.id);
    } catch {
      haptic.warning();
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
      haptic.success();
      refreshCost(plan.id);
    } catch (err) {
      reportError(err);
    } finally {
      setRepickingId(null);
    }
  }

  async function skip(meal: Meal) {
    if (!plan) return;
    try {
      const updated = await api.skipMealSlot(plan.id, meal.id);
      haptic.tap();
      setPlan({ ...plan, meals: plan.meals.map((m) => (m.id === meal.id ? updated : m)) });
      refreshCost(plan.id);
    } catch (err) {
      reportError(err);
    }
  }

  if (loadError && plan === undefined) return <ErrorScreen title="Week" message={loadError} onRetry={load} />;
  if (plan === undefined) return <LoadingScreen title="Week" messages={["Opening your week…"]} />;

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
  // Only meaningful with housemates, and only for the week the split was worked out on.
  const you = members && members.members.length > 1 && members.weekStartDate?.slice(0, 10) === plan.weekStartDate.slice(0, 10)
    ? members.members.find((m) => m.isYou)
    : undefined;

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
        <Text style={{ ...typography.title, color: colors.text }}>Week</Text>
        {isPro ? (
          <TextLink label="Plan My Week" onPress={planMyWeek} />
        ) : null}
      </View>

      {weekCents ? (
        <Appear>
          <Card style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
            <Text style={{ ...typography.bodyStrong, color: colors.text }}>
              {mealsPlanned} meals planned · {dollars(weekCents, 0)} estimated{plan.score ? ` · ${plan.score.total}/100` : ""}
            </Text>
            {you?.weekShareCents != null ? (
              <Text style={{ ...typography.body, color: colors.text }}>
                Your share: {dollars(you.weekShareCents)} of {members!.members.length} people
              </Text>
            ) : null}
            <EstimatedPricingBadge />
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
