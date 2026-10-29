import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, LoadingScreen, ErrorScreen } from "@/components/ui/Screen";
import { LoadingState } from "@/components/ui/States";
import { Appear } from "@/components/ui/Motion";
import { attempt } from "@/components/ui/Toast";
import { haptic } from "@/lib/feedback";
import { useLoad } from "@/lib/useLoad";
import { loadWeekCost, sharesOf } from "@/lib/weekCost";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/Form";
import { ActionSheet, type SheetAction } from "@/components/ui/ActionSheet";
import { MealRow } from "@/components/recipe/MealRow";
import { localDate } from "@/lib/home";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { dollars } from "@/lib/format";
import { useTheme } from "@/theme";
import { api, type Meal, type MealPlan, type MealSlot } from "@/lib/api";

const SIDE_SLOTS: MealSlot[] = ["breakfast", "lunch", "snack"];

const dayLabel = (date: string) =>
  date === localDate() ? "Today" : new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

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
  const [sheet, setSheet] = useState<{ title: string; actions: SheetAction[] } | null>(null);
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

  const pick = (meal: Meal) => router.push({ pathname: "/recipe-picker", params: { mealPlanId: plan.id, mealId: meal.id, slot: meal.slot } });
  const view = (meal: Meal) =>
    router.push({
      pathname: "/recipe/[id]",
      params: { id: meal.recipe!.id, servings: String(meal.servings), ...(meal.type === "leftover" ? { leftover: "1" } : {}) },
    });
  const isEmpty = (meal: Meal) => !meal.recipe && meal.type !== "eat_out";

  const mealActions = (meal: Meal): SheetAction[] => [
    ...(meal.recipe ? [{ label: "View recipe", onPress: () => view(meal) }] : []),
    { label: meal.recipe ? "Change recipe" : "Pick a recipe", onPress: () => pick(meal) },
    ...(isPro && meal.slot === "dinner" && meal.type === "cook" ? [{ label: "New pick", onPress: () => repick(meal) }] : []),
    ...(meal.recipe ? [{ label: "Skip this meal", destructive: true, onPress: () => skip(meal) }] : []),
  ];

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ ...typography.title, color: colors.text }}>Week</Text>
        {isPro ? <TextLink label="Plan My Week" onPress={planMyWeek} /> : null}
      </View>
      {mealsPlanned > 0 ? (
        <Appear>
          <Text style={{ ...typography.bodyStrong, color: colors.text }}>
            {mealsPlanned} meals{weekCents ? ` · ${dollars(weekCents, 0)} estimated` : ""}
            {plan.score ? ` · ${plan.score.total}/100` : ""}
          </Text>
          {yourShare !== undefined ? (
            <Text style={{ ...typography.body, color: colors.textMuted }}>
              Your share: {dollars(yourShare)} of {housemates.length} people
            </Text>
          ) : null}
          {plan.score ? <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>{plan.score.explanation}</Text> : null}
          {weekCents ? (
            <View style={{ marginTop: spacing.sm }}>
              <EstimatedPricingBadge />
            </View>
          ) : null}
        </Appear>
      ) : null}

      {dates.map((date, dayIndex) => {
        const meals = mealsByDate.get(date) ?? [];
        const dinner = meals.find((m) => m.slot === "dinner");
        const sides = SIDE_SLOTS.map((slot) => meals.find((m) => m.slot === slot)).filter((m): m is Meal => !!m);
        const shownSides = sides.filter((m) => !isEmpty(m));
        const emptySides = sides.filter(isEmpty);

        return (
          <Appear key={date} index={dayIndex + 1} style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ ...typography.label, color: date === localDate() ? colors.brandAccent : colors.textMuted }}>{dayLabel(date).toUpperCase()}</Text>
              {emptySides.length > 0 ? (
                <Pressable
                  onPress={() => setSheet({ title: dayLabel(date), actions: emptySides.map((m) => ({ label: `Add ${m.slot}`, onPress: () => pick(m) })) })}
                  accessibilityRole="button"
                  accessibilityLabel={`Add a meal on ${dayLabel(date)}`}
                  style={{ width: minTouch, height: minTouch, marginVertical: -spacing.smd, alignItems: "flex-end", justifyContent: "center" }}
                >
                  <Ionicons name="add-circle-outline" size={24} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {[...(dinner ? [dinner] : []), ...shownSides].map((meal) => (
              <MealRow
                key={meal.id}
                meal={meal}
                main={meal.slot === "dinner"}
                onPress={() => (meal.recipe ? view(meal) : pick(meal))}
                onMenu={() => setSheet({ title: `${dayLabel(date)} · ${meal.slot}`, actions: mealActions(meal) })}
              />
            ))}
          </Appear>
        );
      })}

      <ActionSheet title={sheet?.title} actions={sheet?.actions ?? null} onClose={() => setSheet(null)} />
    </Screen>
  );
}
