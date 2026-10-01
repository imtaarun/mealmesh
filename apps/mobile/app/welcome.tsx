import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button, TextField } from "@/components/ui/Form";
import { AppleSignInButton, GoogleSignInButton, googleConfigured, type SocialResult } from "@/auth/SocialSignIn";
import { useAuth } from "@/auth/AuthProvider";
import { useTheme } from "@/theme";

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
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const onSocial = (result: SocialResult) => run(() => oauth({ ...result, ...invite }));

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl }}>
        <Text style={{ ...typography.display, color: colors.text, marginBottom: spacing.xs }}>Welcome to MealMesh</Text>
        <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.xl }}>
          Plan the week, shop once, waste less.
        </Text>

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
            <Pressable onPress={() => setEmailMode(emailMode === "signup" ? "login" : "signup")} hitSlop={8}>
              <Text style={{ ...typography.caption, color: colors.primary, textAlign: "center", marginBottom: spacing.md }}>
                {emailMode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
              </Text>
            </Pressable>
          </View>
        )}

        {error ? <Text style={{ ...typography.caption, color: colors.danger, marginVertical: spacing.sm }}>{error}</Text> : null}

        <View style={{ marginTop: spacing.lg }}>
          {inviteOpen ? (
            <>
              <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm }}>
                Joining a housemate? Enter their code, then sign up above.
              </Text>
              <TextField placeholder="Invite code" autoCapitalize="characters" value={inviteCode} onChangeText={setInviteCode} />
            </>
          ) : (
            <Pressable onPress={() => setInviteOpen(true)} hitSlop={8}>
              <Text style={{ ...typography.caption, color: colors.primary, textAlign: "center" }}>Have an invite code?</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Screen>
  );
}
