import { useEffect, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Button, Pill, TextLink } from "@/components/ui/Form";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { api, type GroceryList, type Optimization } from "@/lib/api";
import { dollars } from "@/lib/format";
import { haptic } from "@/lib/feedback";
import { attempt } from "@/components/ui/Toast";
import { Appear, CountUp } from "@/components/ui/Motion";
import { useTheme } from "@/theme";

const weekday = (date: string) => new Date(date).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });

/** The week against the budget, with ways to spend less. Refreshes whenever the list changes. */
export function WeekSummary({ list, onPlanChanged }: { list: GroceryList; onPlanChanged: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const [optimization, setOptimization] = useState<Optimization | null>(null);
  const [dealCount, setDealCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attemptNo, setAttemptNo] = useState(0);

  // Ticking items off doesn't change what to buy, so only quantities and "Already have" re-price.
  const basket = list.items.map((i) => `${i.id}:${i.quantity}:${i.alreadyHave}`).join();
  // A short wait so tapping + three times re-prices once.
  useEffect(() => {
    let current = true;
    setFailed(false);
    const wait = setTimeout(() => {
      api.optimizeGroceryList(list.id).then((o) => current && setOptimization(o), () => current && setFailed(true));
      api.getDeals(list.id).then((radar) => current && setDealCount(radar.deals.length), () => {});
    }, optimization ? 400 : 0);
    return () => {
      current = false;
      clearTimeout(wait);
    };
  }, [list.id, basket, attemptNo]);

  if (!optimization) {
    return (
      <Card style={{ marginBottom: spacing.lg, gap: spacing.xs }}>
        <Text style={{ ...typography.label, color: colors.textMuted }}>THIS WEEK</Text>
        <Text style={{ ...typography.body, color: colors.textMuted }}>
          {failed ? "We couldn't check prices just now." : "Pricing your week across five stores…"}
        </Text>
        {failed ? <TextLink label="Try again" onPress={() => setAttemptNo((n) => n + 1)} /> : null}
      </Card>
    );
  }

  const { budget, bestOverall } = optimization;
  const over = budget.remainingCents < 0;
  const swap = async (mealId: string, recipeId: string) => {
    if (!(await attempt(() => api.setMealSlot(list.mealPlanId, mealId, recipeId, true)))) return;
    haptic.success();
    onPlanChanged();
  };

  return (
    <Card style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
      <Text style={{ ...typography.label, color: colors.textMuted }}>THIS WEEK</Text>
      <CountUp cents={budget.plannedCents} format={dollars} style={{ ...typography.title, color: colors.text }} />
      <Text style={{ ...typography.body, color: over ? colors.criticalError : colors.textMuted }}>
        {over
          ? `${dollars(-budget.remainingCents)} over your ${dollars(budget.budgetCents, 0)} budget`
          : `${dollars(budget.remainingCents)} left of your ${dollars(budget.budgetCents, 0)} budget`}
      </Text>
      <EstimatedPricingBadge />

      {budget.swaps.map((s, i) => (
        <Appear key={s.mealId} index={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.text, flex: 1 }}>
            Save {dollars(s.savingsCents)}: {s.to.title} instead of {s.from.title} on {weekday(s.date)}
          </Text>
          <Pill label="Swap" accessibilityLabel={`Swap ${s.from.title} for ${s.to.title}`} onPress={() => swap(s.mealId, s.to.id)} />
        </Appear>
      ))}

      {bestOverall.totalCents > 0 ? (
        <Button
          label={bestOverall.savingsCents > 0 ? `Optimize my cart · save ${dollars(bestOverall.savingsCents)}` : "Where to shop"}
          variant="outline"
          onPress={() => router.push({ pathname: "/optimize", params: { listId: list.id } })}
        />
      ) : null}
      {dealCount > 0 ? (
        <TextLink label={`${dealCount} ${dealCount === 1 ? "deal" : "deals"} on things you need ›`} onPress={() => router.push({ pathname: "/deals", params: { listId: list.id } })} />
      ) : null}
    </Card>
  );
}
