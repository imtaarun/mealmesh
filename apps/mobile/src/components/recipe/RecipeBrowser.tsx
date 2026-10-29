import { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { Screen } from "@/components/ui/Screen";
import { ActionSheet, type SheetAction } from "@/components/ui/ActionSheet";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { TextField, TextLink } from "@/components/ui/Form";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { MealCard } from "@/components/recipe/MealCard";
import { api, type MealSlot, type RecipeFilterOptions, type RecipeFilters, type RecipePage, type RecipeSummary } from "@/lib/api";
import { messageOf } from "@/lib/useLoad";
import { useTheme } from "@/theme";

const PAGE_SIZE = 20;
const TIMES = [15, 30, 45, 60];
const label = (value: string) => value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

type Menu = "cuisine" | "diet" | "time" | "difficulty" | "sort";

/** A dropdown that opens a sheet; shows its current choice once one is set. */
function FilterPill({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  const { colors, spacing, radius, typography, minTouch } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={{
        minHeight: minTouch,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.accentTint : colors.backgroundMuted,
        marginRight: spacing.sm,
      }}
    >
      <Text style={{ ...typography.caption, color: active ? colors.brandAccent : colors.text, fontWeight: active ? "600" : "500" }}>{text}</Text>
      <Ionicons name="chevron-down" size={14} color={active ? colors.brandAccent : colors.textMuted} />
    </PressableScale>
  );
}

/**
 * The recipe library, filtered and paged by the backend: meal-type tabs, dropdown filters,
 * a "fits my household" switch, sorting, infinite scroll and pull to refresh.
 */
export function RecipeBrowser({ title, subtitle, initialSlot = null, onPick }: { title: string; subtitle?: string; initialSlot?: MealSlot | null; onPick: (recipe: RecipeSummary) => void }) {
  const { colors, spacing, typography } = useTheme();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

  const [options, setOptions] = useState<RecipeFilterOptions | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [mealSlot, setMealSlot] = useState<MealSlot | null>(initialSlot);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [dietTags, setDietTags] = useState<string[]>([]);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<RecipeFilters["difficulty"]>(null);
  const [fitsHousehold, setFitsHousehold] = useState(false);
  const [sort, setSort] = useState<"title" | "quickest">("title");
  const [menu, setMenu] = useState<Menu | null>(null);

  const [page, setPage] = useState<RecipePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const latest = useRef(0);

  const filters: RecipeFilters = { query: search, mealSlot, cuisine, dietTags, maxMinutes, difficulty, fitsHousehold, sort };
  const filtersKey = JSON.stringify(filters);
  const anyFilter = !!(search || mealSlot || cuisine || dietTags.length || maxMinutes || difficulty || fitsHousehold);

  // Only the newest request may change the list, so a slow answer to an old filter can't overwrite it.
  async function fetchPage(offset: number) {
    const request = ++latest.current;
    try {
      const next = await api.listRecipes({ ...filters, limit: PAGE_SIZE, offset });
      if (request !== latest.current) return;
      setPage((current) => (offset === 0 || !current ? next : { total: next.total, items: [...current.items, ...next.items] }));
      setError(null);
    } catch (err) {
      if (request === latest.current) setError(messageOf(err));
    }
  }

  useEffect(() => {
    const wait = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(wait);
  }, [query]);
  useEffect(() => {
    fetchPage(0);
  }, [filtersKey]);
  useEffect(() => {
    api.getRecipeFilters().then(setOptions, () => {});
  }, []);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([fetchPage(0), api.getRecipeFilters().then(setOptions, () => {})]);
    setRefreshing(false);
  }

  async function loadMore() {
    if (!page || loadingMore || page.items.length >= page.total) return;
    setLoadingMore(true);
    await fetchPage(page.items.length);
    setLoadingMore(false);
  }

  function clear() {
    setQuery("");
    setSearch("");
    setMealSlot(null);
    setCuisine(null);
    setDietTags([]);
    setMaxMinutes(null);
    setDifficulty(null);
    setFitsHousehold(false);
  }

  const choose = <T,>(current: T, value: T, set: (v: T) => void, text: string): SheetAction => ({ label: text, selected: current === value, onPress: () => set(value) });
  const sheets: Record<Menu, { title: string; actions: SheetAction[] }> = {
    cuisine: {
      title: "Cuisine",
      actions: [
        choose<string | null>(cuisine, null, setCuisine, "Any cuisine"),
        ...(options?.cuisines ?? []).map((c) => choose<string | null>(cuisine, c.value, setCuisine, `${label(c.value)} (${c.count})`)),
      ],
    },
    diet: {
      title: "Diet — dishes must fit all you pick",
      actions: (options?.dietTags ?? []).map((d) => ({
        label: `${label(d.value)} (${d.count})`,
        selected: dietTags.includes(d.value),
        keepOpen: true,
        onPress: () => setDietTags((tags) => (tags.includes(d.value) ? tags.filter((t) => t !== d.value) : [...tags, d.value])),
      })),
    },
    time: {
      title: "Total time",
      actions: [choose<number | null>(maxMinutes, null, setMaxMinutes, "Any time"), ...TIMES.map((m) => choose<number | null>(maxMinutes, m, setMaxMinutes, `Under ${m} min`))],
    },
    difficulty: {
      title: "Difficulty",
      actions: [choose<RecipeFilters["difficulty"]>(difficulty, null, setDifficulty, "Any difficulty"), ...(options?.difficulties ?? []).map((d) => choose<RecipeFilters["difficulty"]>(difficulty, d, setDifficulty, label(d)))],
    },
    sort: {
      title: "Sort by",
      actions: [choose(sort, "title", setSort, "A to Z"), choose(sort, "quickest", setSort, "Quickest first")],
    },
  };

  const header = (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={{ ...typography.title, color: colors.text }}>{title}</Text>
      {subtitle ? <Text style={{ ...typography.body, color: colors.textMuted }}>{subtitle}</Text> : null}
      <View style={{ height: spacing.md }} />
      <TextField placeholder="Search dishes" value={query} onChangeText={setQuery} returnKeyType="search" />

      <View style={{ marginHorizontal: -spacing.lg }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Chip label="All" selected={mealSlot === null} onPress={() => setMealSlot(null)} />
          {(options?.mealSlots ?? []).map((slot) => (
            <Chip key={slot} label={label(slot)} selected={mealSlot === slot} onPress={() => setMealSlot(slot)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Chip label="Fits my household" selected={fitsHousehold} onPress={() => setFitsHousehold((on) => !on)} />
          <FilterPill text={cuisine ? label(cuisine) : "Cuisine"} active={!!cuisine} onPress={() => setMenu("cuisine")} />
          <FilterPill text={dietTags.length ? `Diet · ${dietTags.length}` : "Diet"} active={dietTags.length > 0} onPress={() => setMenu("diet")} />
          <FilterPill text={maxMinutes ? `Under ${maxMinutes} min` : "Time"} active={!!maxMinutes} onPress={() => setMenu("time")} />
          <FilterPill text={difficulty ? label(difficulty) : "Difficulty"} active={!!difficulty} onPress={() => setMenu("difficulty")} />
          <FilterPill text={sort === "quickest" ? "Quickest" : "Sort"} active={sort !== "title"} onPress={() => setMenu("sort")} />
        </ScrollView>
      </View>

      {page ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>{page.total} {page.total === 1 ? "dish" : "dishes"}</Text>
          {anyFilter ? <TextLink label="Clear filters" onPress={clear} /> : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={page?.items ?? []}
        keyExtractor={(recipe) => recipe.id}
        renderItem={({ item }) => <MealCard recipe={item} onPress={() => onPick(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          error && !page ? (
            <ErrorState message={error} onRetry={() => fetchPage(0)} />
          ) : page ? (
            <EmptyState message="Nothing matches that yet. Try fewer filters." actionLabel="Clear filters" onAction={clear} />
          ) : (
            <LoadingState messages={["Opening the recipe box…"]} />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brandAccent} style={{ marginVertical: spacing.md }} /> : undefined}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brandAccent} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xxl + tabBarHeight }}
        showsVerticalScrollIndicator={false}
      />
      <ActionSheet title={menu ? sheets[menu].title : undefined} actions={menu ? sheets[menu].actions : null} onClose={() => setMenu(null)} />
    </Screen>
  );
}
