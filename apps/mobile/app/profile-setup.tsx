import { useEffect, useState } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button, ChipRow, Section, TextField, toggle } from "@/components/ui/Form";
import { useAuth } from "@/auth/AuthProvider";
import { api, type Me } from "@/lib/api";
import { useTheme } from "@/theme";

// Profile setup (first sign-in) and editing (from Profile, with ?edit=1). One short
// screen, every question changes the plan (docs/product-spec.md "Onboarding").
// The owner sets the household and its preferences; a housemate sets only their own
// name, allergies, and dislikes — the planner respects everyone's.
const CUISINES = ["indian", "mediterranean", "north_american", "italian", "mexican", "middle_eastern", "chinese"];
const ALLERGENS = ["peanut", "tree_nut", "dairy", "egg", "gluten", "soy", "fish", "shellfish", "sesame"];
const DIET_TAGS = ["vegetarian", "vegan", "gluten_free", "dairy_free", "low_carb", "high_protein", "healthy"];
const SKILLS = ["beginner", "intermediate", "advanced"];
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const splitList = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);

export default function ProfileSetupScreen() {
  const { colors, spacing, typography } = useTheme();
  const { profileCompleted } = useAuth();
  const editing = useLocalSearchParams<{ edit?: string }>().edit === "1";

  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [servings, setServings] = useState("2");
  const [budget, setBudget] = useState("");
  const [cuisineLikes, setCuisineLikes] = useState<string[]>([]);
  const [dislikesText, setDislikesText] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [skill, setSkill] = useState<string | null>(null);
  const [maxCookMinutes, setMaxCookMinutes] = useState("35");
  const [leftovers, setLeftovers] = useState(true);
  const [busyDays, setBusyDays] = useState<string[]>([]);
  const [eatOutDays, setEatOutDays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getMe().then((loaded) => {
      setMe(loaded);
      setName(loaded.member.name);
      if (loaded.member.role === "owner") {
        const prefs = (type: string) => loaded.household.preferences.filter((p) => p.type === type).map((p) => p.value);
        setHouseholdName(loaded.household.name);
        setServings(String(loaded.household.defaultServings));
        if (loaded.household.weeklyBudgetCents > 0) setBudget(String(Math.round(loaded.household.weeklyBudgetCents / 100)));
        setCuisineLikes(prefs("cuisine_like"));
        setDislikesText(prefs("dislike").join(", "));
        setAllergies(prefs("allergy"));
        setDiets(prefs("diet"));
        setSkill(prefs("skill")[0] ?? null);
        if (prefs("max_cook_minutes")[0]) setMaxCookMinutes(prefs("max_cook_minutes")[0]!);
        if (prefs("leftover_tolerance")[0]) setLeftovers(prefs("leftover_tolerance")[0] === "true");
        setBusyDays(prefs("busy_day"));
        setEatOutDays(prefs("eat_out_day"));
      } else {
        setAllergies(loaded.member.allergies);
        setDislikesText(loaded.member.dislikes.join(", "));
      }
    });
  }, []);

  if (!me) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  const isOwner = me.member.role === "owner";

  async function save() {
    if (!name.trim()) return setError("Please add your name.");
    setSaving(true);
    setError(null);
    try {
      if (isOwner) {
        await api.saveProfile({ name });
        await api.onboard({
          householdName: householdName.trim() || me!.household.name,
          defaultServings: Number(servings) || 2,
          ...(Number(budget) > 0 ? { weeklyBudgetCents: Math.round(Number(budget) * 100) } : {}),
          cuisineLikes,
          dislikes: splitList(dislikesText),
          allergies,
          diets,
          ...(skill ? { skill } : {}),
          ...(Number(maxCookMinutes) > 0 ? { maxCookMinutes: Number(maxCookMinutes) } : {}),
          leftoverTolerance: leftovers,
          busyDays,
          eatOutDays,
        });
      } else {
        await api.saveProfile({ name, allergies, dislikes: splitList(dislikesText) });
      }
      if (editing) router.back();
      else {
        profileCompleted();
        router.replace("/(tabs)");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.xs }}>
        {editing ? "Your preferences" : isOwner ? "Set up your household" : `Welcome to ${me.household.name}`}
      </Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.xl }}>
        {isOwner
          ? "A few questions, and every one of them changes what you get."
          : "Your housemates set the household's plan. Tell us what you can't or won't eat, and every plan will respect it."}
      </Text>

      <Section title="Your name">
        <TextField placeholder="What should housemates call you?" value={name} onChangeText={setName} />
      </Section>

      {isOwner ? (
        <>
          <Section title="Household">
            <TextField placeholder="Household name" value={householdName} onChangeText={setHouseholdName} />
            <TextField placeholder="People per meal" keyboardType="number-pad" value={servings} onChangeText={setServings} />
            <TextField placeholder="Weekly grocery budget ($)" keyboardType="number-pad" value={budget} onChangeText={setBudget} />
          </Section>
          <Section title="Cuisines you like">
            <ChipRow options={CUISINES} selected={cuisineLikes} onToggle={(v) => setCuisineLikes(toggle(cuisineLikes, v))} />
          </Section>
        </>
      ) : null}

      <Section title={isOwner ? "Allergies" : "Your allergies"} hint="Dishes with these are never planned.">
        <ChipRow options={ALLERGENS} selected={allergies} onToggle={(v) => setAllergies(toggle(allergies, v))} />
      </Section>

      <Section title={isOwner ? "Foods you dislike" : "Foods you dislike"} hint="We'll steer around these when we can.">
        <TextField placeholder="e.g. mushroom, olives (comma separated)" value={dislikesText} onChangeText={setDislikesText} />
      </Section>

      {isOwner ? (
        <>
          <Section title="Diet" hint="Healthy and high protein are goals; the rest are strict.">
            <ChipRow options={DIET_TAGS} selected={diets} onToggle={(v) => setDiets(toggle(diets, v))} />
          </Section>
          <Section title="Cooking skill">
            <ChipRow options={SKILLS} selected={skill ? [skill] : []} onToggle={(v) => setSkill(skill === v ? null : v)} />
          </Section>
          <Section title="Max cook time (minutes per meal)">
            <TextField keyboardType="number-pad" value={maxCookMinutes} onChangeText={setMaxCookMinutes} />
          </Section>
          <Section title="Busy days" hint="Quicker meals on these days.">
            <ChipRow options={DAYS} selected={busyDays} onToggle={(v) => setBusyDays(toggle(busyDays, v))} />
          </Section>
          <Section title="Eating out" hint="No dinner planned on these days.">
            <ChipRow options={DAYS} selected={eatOutDays} onToggle={(v) => setEatOutDays(toggle(eatOutDays, v))} />
          </Section>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.xl }}>
            <Switch value={leftovers} onValueChange={setLeftovers} />
            <Text style={{ ...typography.body, color: colors.text, marginLeft: spacing.sm }}>Leftovers for lunch are fine</Text>
          </View>
        </>
      ) : null}

      {error ? <Text style={{ ...typography.caption, color: colors.danger, marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button label={saving ? "Saving…" : editing ? "Save" : "Get started"} disabled={saving} onPress={save} />
    </Screen>
  );
}
