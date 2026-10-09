import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, LoadingScreen, ErrorScreen } from "@/components/ui/Screen";
import { Chip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/Form";
import { EmptyState } from "@/components/ui/EmptyState";
import { Appear } from "@/components/ui/Motion";
import { MealCard } from "@/components/recipe/MealCard";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { useTheme } from "@/theme";

const QUICK = "quick";

export default function DiscoverScreen() {
  const { colors, spacing, typography } = useTheme();
  const { data: recipes, error, reload } = useLoad(() => api.listRecipes(), [], { onFocus: false });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  if (error && !recipes) return <ErrorScreen title="Discover" message={error} onRetry={reload} />;
  if (!recipes) return <LoadingScreen title="Discover" messages={["Opening the recipe box…"]} />;

  const cuisines = [...new Set(recipes.map((r) => r.cuisines[0]).filter((c): c is string => !!c))].sort();
  const q = query.trim().toLowerCase();
  const shown = recipes.filter(
    (r) =>
      (!q || r.title.toLowerCase().includes(q)) &&
      (filter === null || (filter === QUICK ? r.prepMinutes + r.cookMinutes <= 30 : r.cuisines.includes(filter))),
  );

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text }}>Discover</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.md }}>
        {recipes.length} dishes, each costed and ready for cooking mode.
      </Text>
      <TextField placeholder="Search dishes" value={query} onChangeText={setQuery} returnKeyType="search" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.sm }}>
        <Chip label="All" selected={filter === null} onPress={() => setFilter(null)} />
        <Chip label="Under 30 min" selected={filter === QUICK} onPress={() => setFilter(QUICK)} />
        {cuisines.map((c) => (
          <Chip key={c} label={c.replace(/_/g, " ")} selected={filter === c} onPress={() => setFilter(c)} />
        ))}
      </View>

      {shown.length === 0 ? (
        <EmptyState message="Nothing matches that yet. Try another word or filter." />
      ) : (
        shown.map((recipe, i) => (
          <Appear key={recipe.id} index={i} style={{ marginBottom: spacing.md }}>
            <MealCard recipe={recipe} onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: recipe.id } })} />
          </Appear>
        ))
      )}
    </Screen>
  );
}
