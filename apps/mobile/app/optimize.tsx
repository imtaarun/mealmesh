import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, BackLink, LoadingScreen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { api, type Optimization } from "@/lib/api";
import { dollars } from "@/lib/format";
import { useTheme } from "@/theme";

const STRATEGIES = [
  { key: "bestOverall", label: "Best overall", hint: "Two stores only when the second trip pays for itself" },
  { key: "minCost", label: "Cheapest", hint: "Lowest total, however many stores it takes" },
  { key: "minStores", label: "One store", hint: "Everything in a single trip" },
] as const;

/** "chicken, tomatoes and rice" */
const listed = (names: string[]) => {
  const lower = names.map((n) => n.toLowerCase());
  return lower.length <= 1 ? lower.join("") : `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
};

export default function OptimizeScreen() {
  const { colors, spacing, typography } = useTheme();
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const [optimization, setOptimization] = useState<Optimization | null>(null);
  const [chosen, setChosen] = useState<(typeof STRATEGIES)[number]["key"]>("bestOverall");

  useEffect(() => {
    api.optimizeGroceryList(listId).then(setOptimization);
  }, [listId]);

  if (!optimization) return <LoadingScreen back="Shop" />;

  const oneStore = optimization.minStores.totalCents;
  const best = optimization.bestOverall;
  const result = optimization[chosen];
  const extraTrips = Math.max(0, result.stores.length - 1);
  const afterTrips = result.savingsCents - extraTrips * optimization.tripCostCents;

  return (
    <Screen>
      <BackLink label="Shop" />
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Optimize my cart</Text>

      <Card style={{ marginBottom: spacing.lg, gap: spacing.xs }}>
        {best.savingsCents > 0 ? (
          <>
            <Text style={{ ...typography.heading, color: colors.textMuted }}>
              <Text style={{ textDecorationLine: "line-through" }}>{dollars(oneStore)}</Text> → <Text style={{ color: colors.text }}>{dollars(best.totalCents)}</Text>
            </Text>
            <Text style={{ ...typography.title, color: colors.success }}>Save {dollars(best.savingsCents)}</Text>
            {best.topSavingsDrivers.length > 0 ? (
              <Text style={{ ...typography.body, color: colors.text }}>Most of your savings come from {listed(best.topSavingsDrivers)}.</Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={{ ...typography.title, color: colors.text }}>{dollars(best.totalCents)}</Text>
            <Text style={{ ...typography.body, color: colors.text }}>One store is already the best deal this week.</Text>
          </>
        )}
        <EstimatedPricingBadge />
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {STRATEGIES.map((s) => (
          <Chip key={s.key} label={s.label} selected={chosen === s.key} onPress={() => setChosen(s.key)} />
        ))}
      </View>
      <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.md }}>{STRATEGIES.find((s) => s.key === chosen)!.hint}</Text>

      <Text style={{ ...typography.heading, color: colors.text }}>
        {dollars(result.totalCents)} at {result.stores.length} {result.stores.length === 1 ? "store" : "stores"}
      </Text>
      {extraTrips > 0 ? (
        <Text style={{ ...typography.caption, color: afterTrips > 0 ? colors.textMuted : colors.criticalError, marginBottom: spacing.md }}>
          {afterTrips > 0
            ? `Saves about ${dollars(afterTrips)} after ${dollars(optimization.tripCostCents, 0)} for each extra trip`
            : `Costs about ${dollars(-afterTrips)} more than one store once you count ${dollars(optimization.tripCostCents, 0)} per extra trip`}
        </Text>
      ) : (
        <View style={{ height: spacing.md }} />
      )}

      {result.stores.map((store) => (
        <Card key={store.storeId} style={{ marginBottom: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
            <Text style={{ ...typography.heading, color: colors.text, flex: 1 }}>{store.name}</Text>
            <Text style={{ ...typography.heading, color: colors.text }}>{dollars(store.subtotalCents)}</Text>
          </View>
          {store.items.map((item) => (
            <View key={item.ingredientId} style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, color: colors.text }}>{item.name}</Text>
                <Text style={{ ...typography.caption, color: colors.textMuted }}>
                  {item.packs > 1 ? `${item.packs} × ` : ""}
                  {item.product}
                </Text>
              </View>
              <Text style={{ ...typography.body, color: colors.text }}>{dollars(item.cents)}</Text>
            </View>
          ))}
        </Card>
      ))}

      {result.unavailable.length > 0 ? (
        <Text style={{ ...typography.caption, color: colors.textMuted }}>Not sold at these stores: {listed(result.unavailable)}.</Text>
      ) : null}
    </Screen>
  );
}
