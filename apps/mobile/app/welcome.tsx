import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { IconBadge } from "@/components/ui/IconBadge";
import { Appear } from "@/components/ui/Motion";
import { haptic } from "@/lib/feedback";
import { Screen } from "@/components/ui/Screen";
import { Button, TextField, TextLink } from "@/components/ui/Form";
import { AppleSignInButton, GoogleSignInButton, googleConfigured, type SocialResult } from "@/auth/SocialSignIn";
import { useAuth } from "@/auth/AuthProvider";
import { useTheme } from "@/theme";

const PROMISES = [
  { icon: "calendar-outline", text: "Pick the week's dinners — or let MealMesh plan them." },
  { icon: "list-outline", text: "One shopping list, with what you already have taken off." },
  { icon: "pricetag-outline", text: "The cheapest way to buy it, store by store." },
  { icon: "flame-outline", text: "Cook step by step, timers included." },
] as const;

export default function WelcomeScreen() {
  const { colors, spacing, typography } = useTheme();
  const { signup, login, oauth } = useAuth();
  const [emailMode, setEmailMode] = useState<"closed" | "login" | "signup">("closed");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = inviteCode.trim() ? { inviteCode: inviteCode.trim() } : {};

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      // The tabs layout sends a new account on to profile setup.
      router.replace("/(tabs)");
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const onSocial = (result: SocialResult) => run(() => oauth({ ...result, ...invite }));

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xl }}>
        <Appear>
          <Text style={{ ...typography.display, color: colors.text, marginBottom: spacing.xs }}>Dinner, sorted.</Text>
          <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.lg }}>Plan the week, shop once, waste less.</Text>
        </Appear>
        {PROMISES.map((promise, i) => (
          <Appear key={promise.icon} index={i + 1} style={{ flexDirection: "row", alignItems: "center", gap: spacing.smd, marginBottom: spacing.smd }}>
            <IconBadge name={promise.icon} />
            <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>{promise.text}</Text>
          </Appear>
        ))}
        <View style={{ height: spacing.lg }} />

        <AppleSignInButton onResult={onSocial} onError={setError} />
        {googleConfigured ? <GoogleSignInButton onResult={onSocial} onError={setError} /> : null}

        {emailMode === "closed" ? (
          <Button label="Continue with email" variant="outline" onPress={() => setEmailMode("signup")} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <TextField placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
            <TextField placeholder="Password (8+ characters)" secureTextEntry value={password} onChangeText={setPassword} />
            {emailMode === "signup" ? (
              <Button label={busy ? "Creating your account…" : "Create account"} disabled={busy} onPress={() => run(() => signup({ email, password, ...invite }))} />
            ) : (
              <Button label={busy ? "Logging in…" : "Log in"} disabled={busy} onPress={() => run(() => login(email, password))} />
            )}
            <TextLink
              align="center"
              label={emailMode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
              onPress={() => setEmailMode(emailMode === "signup" ? "login" : "signup")}
            />
          </View>
        )}

        {error ? <Text style={{ ...typography.caption, color: colors.criticalError, marginVertical: spacing.sm }}>{error}</Text> : null}

        <View style={{ marginTop: spacing.lg }}>
          {inviteOpen ? (
            <>
              <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm }}>
                Joining a housemate? Enter their code, then sign up above.
              </Text>
              <TextField placeholder="Invite code" autoCapitalize="characters" value={inviteCode} onChangeText={setInviteCode} />
            </>
          ) : (
            <TextLink align="center" label="Have an invite code?" onPress={() => setInviteOpen(true)} />
          )}
        </View>
      </View>
    </Screen>
  );
}
