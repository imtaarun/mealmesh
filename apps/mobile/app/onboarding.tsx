import { useState } from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Chip } from "@/components/ui/Chip";
import { useTheme } from "@/theme";
import { useAuth } from "@/auth/AuthProvider";

// One short flow (docs/product-spec.md "Onboarding + preferences") — account,
// household, and every preference on a single screen, not a multi-step wizard.
const CUISINES = ["indian", "mediterranean", "north_american", "italian", "mexican", "middle_eastern"];
const ALLERGENS = ["peanut", "tree_nut", "dairy", "egg", "gluten", "soy", "fish", "shellfish", "sesame"];
const DIET_TAGS = ["vegetarian", "vegan", "gluten_free", "dairy_free", "low_carb", "high_protein", "healthy"];
const SKILLS = ["beginner", "intermediate", "advanced"];
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...typography.heading, color: colors.text, marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );
}

function ChipRow({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {options.map((option) => (
        <Chip key={option} label={option.replace(/_/g, " ")} selected={selected.includes(option)} onPress={() => onToggle(option)} />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { signup, onboard } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [defaultServings, setDefaultServings] = useState("2");
  const [cuisineLikes, setCuisineLikes] = useState<string[]>([]);
  const [dislikesText, setDislikesText] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [skill, setSkill] = useState<string | null>(null);
  const [maxCookMinutes, setMaxCookMinutes] = useState("35");
  const [leftoverTolerance, setLeftoverTolerance] = useState(true);
  const [busyDays, setBusyDays] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  };

  async function handleSubmit() {
    if (!email || !password || !householdName) {
      Alert.alert("Almost there", "Email, password, and a household name are required.");
      return;
    }
    setSubmitting(true);
    try {
      if (!accountCreated) {
        await signup({
          email,
          password,
          householdName,
          defaultServings: Number(defaultServings) || 2,
        });
        setAccountCreated(true);
      }
      await onboard({
        cuisineLikes,
        dislikes: dislikesText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        allergies,
        diets,
        skill: skill ?? undefined,
        maxCookMinutes: Number(maxCookMinutes) || undefined,
        leftoverTolerance,
        busyDays,
        eatOutDays: [],
      });
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      Alert.alert(accountCreated ? "Couldn't save your preferences" : "Couldn't create your account", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text style={{ ...typography.display, color: colors.text, marginBottom: spacing.xs }}>Welcome to MealMesh</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.xl }}>
        A few questions, and every one of them changes what you get.
      </Text>

      <Section title="Account">
        <TextInput
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={inputStyle}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </Section>

      <Section title="Household">
        <TextInput
          style={inputStyle}
          placeholder="Household name"
          placeholderTextColor={colors.textMuted}
          value={householdName}
          onChangeText={setHouseholdName}
        />
        <TextInput
          style={inputStyle}
          placeholder="Default servings per meal"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          value={defaultServings}
          onChangeText={setDefaultServings}
        />
      </Section>

      <Section title="Cuisines you like">
        <ChipRow options={CUISINES} selected={cuisineLikes} onToggle={(v) => setCuisineLikes(toggle(cuisineLikes, v))} />
      </Section>

      <Section title="Foods you dislike">
        <TextInput
          style={inputStyle}
          placeholder="e.g. mushroom, olives (comma separated)"
          placeholderTextColor={colors.textMuted}
          value={dislikesText}
          onChangeText={setDislikesText}
        />
      </Section>

      <Section title="Allergies">
        <ChipRow options={ALLERGENS} selected={allergies} onToggle={(v) => setAllergies(toggle(allergies, v))} />
      </Section>

      <Section title="Dietary preferences">
        <ChipRow options={DIET_TAGS} selected={diets} onToggle={(v) => setDiets(toggle(diets, v))} />
      </Section>

      <Section title="Cooking skill">
        <ChipRow options={SKILLS} selected={skill ? [skill] : []} onToggle={(v) => setSkill(skill === v ? null : v)} />
      </Section>

      <Section title="Max cook time (minutes per meal)">
        <TextInput
          style={inputStyle}
          keyboardType="number-pad"
          value={maxCookMinutes}
          onChangeText={setMaxCookMinutes}
        />
      </Section>

      <Section title="Busy days (shorter meals only)">
        <ChipRow options={DAYS} selected={busyDays} onToggle={(v) => setBusyDays(toggle(busyDays, v))} />
      </Section>

      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.xl }}>
        <Switch value={leftoverTolerance} onValueChange={setLeftoverTolerance} />
        <Text style={{ ...typography.body, color: colors.text, marginLeft: spacing.sm }}>I'm fine eating leftovers</Text>
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        style={({ pressed }) => ({
          backgroundColor: pressed || submitting ? colors.primaryPressed : colors.primary,
          borderRadius: radius.pill,
          paddingVertical: spacing.md,
          alignItems: "center",
        })}
      >
        <Text style={{ ...typography.bodyStrong, color: colors.background }}>
          {submitting ? "Setting things up…" : "Get Started"}
        </Text>
      </Pressable>
    </Screen>
  );
}
