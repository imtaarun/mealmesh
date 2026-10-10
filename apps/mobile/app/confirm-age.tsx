import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button, TextLink } from "@/components/ui/Form";
import { DateOfBirthField } from "@/components/ui/DateOfBirthField";
import { useAuth } from "@/auth/AuthProvider";
import { haptic } from "@/lib/feedback";
import { useTheme } from "@/theme";

// Accounts made before the age check answer once; new accounts never see this.
export default function ConfirmAgeScreen() {
  const { colors, spacing, typography } = useTheme();
  const { confirmAge, logout } = useAuth();
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!dateOfBirth) return setError("Add your date of birth.");
    setBusy(true);
    setError(null);
    try {
      await confirmAge(dateOfBirth);
      router.replace("/(tabs)");
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={{ ...typography.display, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.xs }}>One quick thing</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.lg }}>
        We now ask everyone for their date of birth. We keep only the year.
      </Text>
      <DateOfBirthField onChange={setDateOfBirth} />
      <Button label={busy ? "Saving…" : "Continue"} disabled={busy} onPress={save} />
      {error ? <Text style={{ ...typography.caption, color: colors.criticalError, marginVertical: spacing.sm }}>{error}</Text> : null}
      <TextLink align="center" label="Log out" onPress={() => logout().then(() => router.replace("/welcome"))} />
    </Screen>
  );
}
