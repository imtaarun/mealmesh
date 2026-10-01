import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Form";
import { useAuth } from "@/auth/AuthProvider";
import { confirm } from "@/lib/confirm";
import { api } from "@/lib/api";
import { useTheme } from "@/theme";

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface DataExport {
  account: { email: string; createdAt: string; signInMethods: string[]; sessions: unknown[] };
  profile: { name: string; allergies: string[]; dislikes: string[]; ratings: unknown[] };
  household: { name: string; preferences: unknown[]; housemates: unknown[] };
  pantry: unknown[];
  mealPlans: Array<{ meals: unknown[] }>;
}

// Everything we store about you, in plain words — with a full download and a way to
// delete your account. Privacy rules (and Apple's App Store rules) expect both.
export default function MyDataScreen() {
  const { colors, spacing, typography } = useTheme();
  const { deleteAccount } = useAuth();
  const [data, setData] = useState<DataExport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.exportMyData().then((d) => setData(d as DataExport));
  }, []);

  const back = (
    <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginBottom: spacing.md }}>
      <Text style={{ ...typography.caption, color: colors.primary }}>‹ Profile</Text>
    </Pressable>
  );

  if (!data) {
    return (
      <Screen>
        {back}
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  const rows = [
    { label: "Account", value: `${data.account.email}, since ${data.account.createdAt.slice(0, 10)}` },
    { label: "Sign-ins", value: `${count(data.account.sessions.length, "session")} · ${data.account.signInMethods.join(", ")}` },
    { label: "Your profile", value: `${data.profile.name} · ${data.profile.allergies.length === 1 ? "1 allergy" : `${data.profile.allergies.length} allergies`} · ${count(data.profile.dislikes.length, "dislike")}` },
    { label: "Household", value: `${data.household.name} · ${data.household.housemates.length === 1 ? "1 person" : `${data.household.housemates.length} people`} · ${count(data.household.preferences.length, "preference")}` },
    { label: "Pantry", value: count(data.pantry.length, "item") },
    { label: "Meal plans", value: `${count(data.mealPlans.length, "week")} · ${count(data.mealPlans.reduce((n, p) => n + p.meals.length, 0), "meal slot")}` },
    { label: "Ratings", value: `${data.profile.ratings.length}` },
  ];

  async function remove() {
    const ok = await confirm(
      "Delete your account?",
      "This can't be undone. If you're the only one in your household, its plans and pantry are deleted too. Housemates keep the household.",
      "Delete",
    );
    if (!ok) return;
    setBusy(true);
    await deleteAccount();
  }

  return (
    <Screen>
      {back}
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.xs }}>Your data</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.lg }}>
        This is everything MealMesh stores about you. Passwords and sign-in tokens are never shown or shared.
      </Text>

      <Card style={{ marginBottom: spacing.lg, gap: spacing.md }}>
        {rows.map((r) => (
          <View key={r.label}>
            <Text style={{ ...typography.label, color: colors.textMuted }}>{r.label.toUpperCase()}</Text>
            <Text style={{ ...typography.body, color: colors.text }}>{r.value}</Text>
          </View>
        ))}
      </Card>

      <Button label="Download my data" variant="outline" onPress={() => Share.share({ title: "My MealMesh data", message: JSON.stringify(data, null, 2) })} />
      <Button label={busy ? "Deleting…" : "Delete my account"} variant="danger" disabled={busy} onPress={remove} />
    </Screen>
  );
}
