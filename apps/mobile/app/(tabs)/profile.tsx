import { useEffect, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, LoadingScreen, ErrorScreen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { EstimatedPricingBadge } from "@/components/ui/EstimatedPricingBadge";
import { Button, Pill, TextField } from "@/components/ui/Form";
import { Chip } from "@/components/ui/Chip";
import { useAuth } from "@/auth/AuthProvider";
import { confirm } from "@/lib/confirm";
import { api, type Housemate, type Members } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { loadWeekCost, sharesOf } from "@/lib/weekCost";
import { dollars } from "@/lib/format";
import { useTheme } from "@/theme";

const METHOD_LABELS: Record<string, string> = { email: "email", google: "Google", apple: "Apple" };

export default function ProfileScreen() {
  const { colors, spacing, typography, palette, setPalette, minTouch } = useTheme();
  const { logout } = useAuth();
  const { data, setData, error: loadError, reload } = useLoad(async () => {
    const [me, members, plan] = await Promise.all([api.getMe(), api.getMembers(), api.getCurrentPlan()]);
    return { me, members, plan };
  });
  const [weekCents, setWeekCents] = useState<number | null>(null);
  const me = data?.me;
  const members = data?.members;
  const setMembers = (next: Members) => setData((d) => d && { ...d, members: next });
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The split uses the same Best overall figure Week and Shop show.
  useEffect(() => {
    let current = true;
    if (!data?.plan) setWeekCents(null);
    else loadWeekCost(data.plan.id).then((cents) => current && setWeekCents(cents), () => current && setWeekCents(null));
    return () => {
      current = false;
    };
  }, [data?.plan]);

  async function attempt(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (loadError && !data) return <ErrorScreen title="Profile" message={loadError} onRetry={reload} />;
  if (!me || !members) return <LoadingScreen messages={["Getting your household…"]} />;
  const shares = weekCents ? sharesOf(weekCents, members.members) : null;

  const isOwner = me.member.role === "owner";
  const alone = members.members.length === 1;

  const shareInvite = (code: string) =>
    Share.share({ message: `Join our household on MealMesh — open the app, tap "Have an invite code?", and enter ${code}` });

  async function remove(person: Housemate) {
    if (await confirm(`Remove ${person.name}?`, "They keep their account and get a household of their own.", "Remove")) {
      await attempt(async () => setMembers(await api.removeHousemate(person.id)));
    }
  }

  async function leave() {
    if (await confirm(`Leave ${me!.household.name}?`, "You'll keep your account and start a household of your own.", "Leave")) {
      await attempt(async () => {
        await api.leaveHousehold();
        reload();
      });
    }
  }

  async function join() {
    if (await confirm("Join this household?", "Your current household and its plans will be deleted, and you'll share your new housemates' week instead.", "Join")) {
      await attempt(async () => {
        await api.joinHousehold(joinCode.trim());
        setJoinCode("");
        reload();
      });
    }
  }

  const row = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const };

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text }}>{me.member.name}</Text>
      <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg }}>
        {me.user.email} · signs in with {me.user.signInMethods.map((m) => METHOD_LABELS[m] ?? m).join(" and ")}
      </Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <Pressable onPress={() => router.push({ pathname: "/profile-setup", params: { edit: "1" } })} style={{ ...row, minHeight: minTouch }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ ...typography.bodyStrong, color: colors.text }}>{isOwner ? "Household preferences" : "Your preferences"}</Text>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              {isOwner ? "Budget, cuisines, diet, allergies, cook time" : "Your allergies and dislikes"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={{ ...typography.bodyStrong, color: colors.text, marginBottom: spacing.sm }}>Appearance</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <Chip label="Green forest" selected={palette === "forest"} onPress={() => setPalette("forest")} />
          <Chip label="Autumn fall" selected={palette === "autumn"} onPress={() => setPalette("autumn")} />
        </View>
      </Card>

      <Text style={{ ...typography.heading, color: colors.text, marginBottom: spacing.sm }}>{me.household.name}</Text>
      <Card style={{ marginBottom: spacing.lg, gap: spacing.md }}>
        {weekCents && !alone ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              This week's groceries, about {dollars(weekCents)}, split by share
            </Text>
            <EstimatedPricingBadge />
          </View>
        ) : null}

        {members.members.map((person) => (
          <View key={person.id} style={{ gap: spacing.xs }}>
            <View style={row}>
              <Text style={{ ...typography.bodyStrong, color: colors.text, flexShrink: 1 }}>
                {person.name}
                {person.isYou ? " (you)" : ""}
                {person.role === "owner" ? " · owner" : ""}
              </Text>
              {shares && !alone ? (
                <Text style={{ ...typography.bodyStrong, color: colors.text }}>{dollars(shares[person.id]!)}</Text>
              ) : null}
            </View>
            {isOwner && !alone ? (
              <View style={{ ...row, justifyContent: "flex-start", gap: spacing.sm }}>
                <Text style={{ ...typography.caption, color: colors.textMuted }}>
                  {person.costShare === 0 ? "Not paying" : person.costShare === 1 ? "1 share" : `${person.costShare} shares`}
                </Text>
                <Pill label="−" variant="neutral" accessibilityLabel={`Fewer shares for ${person.name}`} onPress={() => attempt(async () => setMembers(await api.setCostShare(person.id, Math.max(0, person.costShare - 1))))} />
                <Pill label="+" variant="neutral" accessibilityLabel={`More shares for ${person.name}`} onPress={() => attempt(async () => setMembers(await api.setCostShare(person.id, Math.min(10, person.costShare + 1))))} />
                {!person.isYou ? <Pill label="Remove" variant="danger" accessibilityLabel={`Remove ${person.name}`} onPress={() => remove(person)} /> : null}
              </View>
            ) : null}
          </View>
        ))}

        {isOwner ? (
          invite ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>Invite code — works once, for 7 days:</Text>
              <Text style={{ ...typography.title, color: colors.text, letterSpacing: 4 }}>{invite.code}</Text>
              <Button label="Share code" variant="outline" onPress={() => shareInvite(invite.code)} />
            </View>
          ) : (
            <Button label="Invite a housemate" variant="outline" onPress={() => attempt(async () => setInvite(await api.createInvite()))} />
          )
        ) : (
          <Button label="Leave household" variant="danger" onPress={leave} />
        )}
      </Card>

      {alone ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...typography.bodyStrong, color: colors.text, marginBottom: spacing.xs }}>Join a housemate's household</Text>
          <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm }}>Got an invite code? Enter it to plan and split costs together.</Text>
          <TextField placeholder="Invite code" autoCapitalize="characters" value={joinCode} onChangeText={setJoinCode} />
          <Button label="Join" variant="outline" disabled={!joinCode.trim()} onPress={join} />
        </Card>
      ) : null}

      {error ? <Text style={{ ...typography.caption, color: colors.criticalError, marginBottom: spacing.md }}>{error}</Text> : null}

      <Card style={{ marginBottom: spacing.lg, gap: spacing.md }}>
        {[
          { label: "Your history", hint: "Weeks planned, meals cooked, money spent", path: "/history" as const },
          { label: "Your data", hint: "Everything we store about you — download or delete", path: "/my-data" as const },
        ].map((item) => (
          <Pressable key={item.path} onPress={() => router.push(item.path)} style={{ ...row, minHeight: minTouch }}>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ ...typography.bodyStrong, color: colors.text }}>{item.label}</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>{item.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </Card>

      <Button label="Sign out" variant="outline" onPress={logout} />
    </Screen>
  );
}
