import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { api, type History } from "@/lib/api";
import { useTheme } from "@/theme";

const dollars = (cents: number) => `$${(cents / 100).toFixed(0)}`;

// Your history with MealMesh: every week planned, what got cooked, what it was
// estimated to cost, and how it scored.
export default function HistoryScreen() {
  const { colors, spacing, typography } = useTheme();
  const [history, setHistory] = useState<History | null>(null);

  useEffect(() => {
    api.getHistory().then(setHistory);
  }, []);

  const back = (
    <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginBottom: spacing.md }}>
      <Text style={{ ...typography.caption, color: colors.primary }}>‹ Profile</Text>
    </Pressable>
  );

  if (!history) {
    return (
      <Screen>
        {back}
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  const { totals } = history;
  const stats = [
    { label: "Weeks planned", value: String(totals.weeksPlanned) },
    { label: "Meals cooked", value: String(totals.mealsCooked) },
    { label: "Groceries", value: dollars(totals.estimatedSpendCents) },
    { label: "Average score", value: totals.averageScore === null ? "—" : `${totals.averageScore}/100` },
  ];

  return (
    <Screen>
      {back}
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.lg }}>Your history</Text>

      {history.weeks.length === 0 ? (
        <EmptyState message="Your history starts with your first planned week." />
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm }}>
            {stats.map((stat) => (
              <Card key={stat.label} style={{ flexGrow: 1, flexBasis: "45%" }}>
                <Text style={{ ...typography.title, color: colors.text }}>{stat.value}</Text>
                <Text style={{ ...typography.caption, color: colors.textMuted }}>{stat.label}</Text>
              </Card>
            ))}
          </View>
          <View style={{ marginBottom: spacing.lg }}>
            <EstimatedPricingBadge />
          </View>

          {history.favourites.length > 0 ? (
            <>
              <Text style={{ ...typography.heading, color: colors.text, marginBottom: spacing.sm }}>Most cooked</Text>
              <Card style={{ marginBottom: spacing.lg, gap: spacing.xs }}>
                {history.favourites.map((dish) => (
                  <Text key={dish.title} style={{ ...typography.body, color: colors.text }}>
                    {dish.title} <Text style={{ color: colors.textMuted }}>· {dish.times}×</Text>
                  </Text>
                ))}
              </Card>
            </>
          ) : null}

          <Text style={{ ...typography.heading, color: colors.text, marginBottom: spacing.sm }}>Weeks</Text>
          {history.weeks.map((week) => (
            <Card key={week.mealPlanId} style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
              <Text style={{ ...typography.bodyStrong, color: colors.text }}>Week of {week.weekStartDate.slice(0, 10)}</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                {week.mealsCooked} cooked · {week.leftoverMeals} leftovers
                {week.estimatedCostCents !== null ? ` · ${dollars(week.estimatedCostCents)} estimated` : ""}
                {week.score !== null ? ` · ${week.score}/100` : ""}
              </Text>
              {week.dishes.length > 0 ? (
                <Text style={{ ...typography.caption, color: colors.text }}>{week.dishes.join(" · ")}</Text>
              ) : null}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
