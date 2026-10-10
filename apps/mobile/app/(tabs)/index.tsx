import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, LoadingScreen, ErrorScreen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Form";
import { Appear } from "@/components/ui/Motion";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { CuisinePlaceholder } from "@/components/recipe/CuisinePlaceholder";
import { dinnerOn, greeting, loadHome, localDate, subline, suggestions } from "@/lib/home";
import { IconBadge } from "@/components/ui/IconBadge";
import { useLoad } from "@/lib/useLoad";
import { dollars } from "@/lib/format";
import { useTheme } from "@/theme";

const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

export default function HomeScreen() {
  const { colors, spacing, radius, typography, minTouch } = useTheme();
  const { data: home, error, reload } = useLoad(loadHome);

  if (error && !home) return <ErrorScreen message={error} onRetry={reload} />;
  if (!home) return <LoadingScreen messages={["Looking at your week…", "Checking what's in the pantry…", "Comparing your ingredients…"]} />;

  const { plan } = home;
  const today = localDate();
  const tonight = dinnerOn(plan, today);
  const dinners = plan?.meals.filter((m) => m.slot === "dinner").sort((a, b) => a.date.localeCompare(b.date)) ?? [];
  const isFilled = (meal: { type: string }) => meal.type === "cook" || meal.type === "leftover";
  const planned = dinners.filter(isFilled).length;
  const estimate = home.optimization?.budget.plannedCents ?? 0;
  const ideas = suggestions(home);

  return (
    <Screen>
      <Appear>
        <Text style={{ ...typography.display, color: colors.text }}>{greeting(home.name)}</Text>
        <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.lg }}>{subline(home)}</Text>
      </Appear>

      {tonight?.recipe && tonight.type !== "eat_out" ? (
        <Appear index={1}>
          <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>TONIGHT</Text>
          <Card style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            <CuisinePlaceholder cuisine={tonight.recipe.cuisines[0] ?? "other"} />
            <Text style={{ ...typography.title, color: colors.text }}>{tonight.type === "leftover" ? `Leftovers · ${tonight.recipe.title}` : tonight.recipe.title}</Text>
            <Text style={{ ...typography.body, color: colors.textMuted }}>
              {tonight.type === "leftover" ? "Just reheat" : `${tonight.recipe.prepMinutes + tonight.recipe.cookMinutes} min · ${tonight.recipe.difficulty}`} · serves {tonight.servings}
            </Text>
            {tonight.type === "cook" ? (
              <Button label="Start cooking" onPress={() => router.push({ pathname: "/cook/[id]", params: { id: tonight.recipe!.id } })} />
            ) : null}
            <Button
              label="View recipe"
              variant="outline"
              onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: tonight.recipe!.id, servings: String(tonight.servings) } })}
            />
          </Card>
        </Appear>
      ) : !plan ? (
        <Appear index={1}>
          <Card style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.title, color: colors.text }}>Seven days. Zero decisions.</Text>
            <Text style={{ ...typography.body, color: colors.textMuted }}>Pick the week's dinners once — the shopping list, the cheapest stores and the cooking steps follow.</Text>
            <Button label="Plan your week" onPress={() => router.push("/(tabs)/week")} />
          </Card>
        </Appear>
      ) : null}

      {plan ? (
        <Appear index={2}>
          <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>THIS WEEK</Text>
          <Card onPress={() => router.push("/(tabs)/week")} style={{ gap: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }} accessibilityLabel={`${planned} of 7 dinners planned`}>
              {dinners.map((meal, i) => {
                const isToday = meal.date.slice(0, 10) === today;
                const filled = isFilled(meal);
                return (
                  <View key={meal.id} style={{ alignItems: "center", gap: spacing.xs }}>
                    <Text style={{ ...typography.label, color: isToday ? colors.brandAccent : colors.textMuted }}>{DAY_INITIALS[i]}</Text>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: radius.pill,
                        backgroundColor: filled ? colors.accentTint : colors.backgroundMuted,
                        borderWidth: isToday ? 2 : 0,
                        borderColor: colors.brandAccent,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {filled ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandAccent }} /> : null}
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={{ ...typography.bodyStrong, color: colors.text }}>
              {planned} {planned === 1 ? "dinner" : "dinners"} planned
              {estimate > 0 ? ` · ${dollars(estimate, 0)} estimated` : ""}
              {plan.score ? ` · ${plan.score.total}/100` : ""}
            </Text>
            {estimate > 0 ? <EstimatedPricingBadge /> : null}
          </Card>
        </Appear>
      ) : null}

      {ideas.length > 0 ? (
        <Appear index={3}>
          <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>FOR YOU</Text>
          <Card style={{ paddingVertical: spacing.xs }}>
            {ideas.map((idea) => (
              <Pressable
                key={idea.icon}
                onPress={() => router.push(idea.href)}
                accessibilityRole="button"
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.smd, minHeight: minTouch + spacing.sm, paddingVertical: spacing.xs }}
              >
                <IconBadge name={idea.icon} size={36} />
                <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>{idea.text}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </Card>
        </Appear>
      ) : null}
    </Screen>
  );
}
