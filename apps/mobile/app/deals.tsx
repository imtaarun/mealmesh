import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, BackLink, LoadingScreen, ErrorScreen } from "@/components/ui/Screen";
import { Appear } from "@/components/ui/Motion";
import { useLoad } from "@/lib/useLoad";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { api } from "@/lib/api";
import { dollars } from "@/lib/format";
import { useTheme } from "@/theme";

/** Deal Radar: only sales on what this week's list still needs. */
export default function DealsScreen() {
  const { colors, spacing, typography } = useTheme();
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const { data: radar, error, reload } = useLoad(() => api.getDeals(listId), [listId], { onFocus: false });

  if (error && !radar) return <ErrorScreen back="Shop" title="Deal Radar" message={error} onRetry={reload} />;
  if (!radar) return <LoadingScreen back="Shop" title="Deal Radar" messages={["Scanning this week's sales…", "Matching them to your list…"]} />;

  return (
    <Screen>
      <BackLink label="Shop" />
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.xs }}>Deal Radar</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.md }}>Sales on things your meals use this week.</Text>

      {radar.deals.length === 0 ? (
        <EmptyState message="Nothing on sale that you actually need this week. That's a good week." />
      ) : (
        <>
          <View style={{ marginBottom: spacing.md }}>
            <EstimatedPricingBadge />
          </View>
          {radar.deals.map((deal, i) => (
            <Appear key={deal.id} index={i}>
              <Card style={{ marginBottom: spacing.md, gap: spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
                  <Text style={{ ...typography.heading, color: colors.text, flex: 1 }}>{deal.item}</Text>
                  <Text style={{ ...typography.heading, color: colors.success }}>{Math.round(deal.discountPercent)}% off</Text>
                </View>
                <Text style={{ ...typography.caption, color: colors.textMuted }}>
                  {deal.store} · {deal.packs > 1 ? `${deal.packs} × ` : ""}
                  {deal.product}
                </Text>
                <Text style={{ ...typography.body, color: colors.text }}>
                  <Text style={{ color: colors.textMuted, textDecorationLine: "line-through" }}>{dollars(deal.regularCents)}</Text> {dollars(deal.saleCents)} · save{" "}
                  {dollars(deal.savingsCents)}
                </Text>
                <Text style={{ ...typography.caption, color: colors.textMuted }}>
                  Used in {deal.mealsUsing} {deal.mealsUsing === 1 ? "meal" : "meals"} this week
                </Text>
              </Card>
            </Appear>
          ))}
        </>
      )}
    </Screen>
  );
}
