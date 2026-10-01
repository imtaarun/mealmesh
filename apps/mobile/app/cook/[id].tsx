import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, Vibration, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { api, type RecipeDetail } from "@/lib/api";
import { useTheme } from "@/theme";

// Cooking mode — docs/ux.md "Cooking mode": full screen, one step, large type,
// thumb-reachable prev/next at the bottom, inline timers on timed steps, the screen
// stays awake, and ✕ goes back to where you came from. Timers keep running when you
// move between steps (something can simmer on step 2 while you chop for step 3).

interface StepTimer {
  endsAt: number | null; // running: when it hits zero
  remainingMs: number; // paused or not started: what's left
}

const clock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export default function CookingScreen() {
  useKeepAwake();
  const { colors, spacing, typography, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [index, setIndex] = useState(0);
  const [timers, setTimers] = useState<Record<number, StepTimer>>({});
  const [now, setNow] = useState(Date.now());
  const [buzzed, setBuzzed] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.getRecipe(id).then(setRecipe);
  }, [id]);

  const running = Object.entries(timers).filter(([, t]) => t.endsAt !== null);
  useEffect(() => {
    if (running.length === 0) return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [running.length]);

  // Buzz once when a running timer reaches zero.
  useEffect(() => {
    for (const [step, t] of running) {
      if (t.endsAt !== null && t.endsAt <= now && !buzzed.has(Number(step))) {
        Vibration.vibrate([0, 400, 200, 400]);
        setBuzzed(new Set(buzzed).add(Number(step)));
      }
    }
  }, [now]);

  if (!recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const steps = recipe.instructions;
  const step = steps[index]!;
  const last = index === steps.length - 1;
  const remaining = (i: number) => {
    const t = timers[i];
    if (!t) return (steps[i]!.timerSeconds ?? 0) * 1000;
    return t.endsAt !== null ? t.endsAt - now : t.remainingMs;
  };
  const timer = timers[index];
  const left = remaining(index);
  const done = timer !== undefined && left <= 0;

  const start = () => {
    setTimers({ ...timers, [index]: { endsAt: Date.now() + left, remainingMs: left } });
    setNow(Date.now());
  };
  const pause = () => setTimers({ ...timers, [index]: { endsAt: null, remainingMs: left } });
  const reset = () => {
    const next = { ...timers };
    delete next[index];
    setTimers(next);
    const b = new Set(buzzed);
    b.delete(index);
    setBuzzed(b);
  };

  const navButton = (labelText: string, onPress: () => void, primary: boolean, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: spacing.lg,
        alignItems: "center",
        borderRadius: radius.pill,
        backgroundColor: primary ? (pressed ? colors.primaryPressed : colors.primary) : colors.surface,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Text style={{ ...typography.heading, color: primary ? colors.background : colors.text }}>{labelText}</Text>
    </Pressable>
  );

  const otherTimers = running.filter(([i]) => Number(i) !== index);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg }}>
        <Text style={{ ...typography.label, color: colors.textMuted }}>
          STEP {index + 1} OF {steps.length}
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Leave cooking mode">
          <Text style={{ ...typography.heading, color: colors.textMuted }}>✕</Text>
        </Pressable>
      </View>

      {otherTimers.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {otherTimers.map(([i]) => (
            <Pressable key={i} onPress={() => setIndex(Number(i))} style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
              <Text style={{ ...typography.caption, color: remaining(Number(i)) <= 0 ? colors.danger : colors.text }}>
                ⏱ Step {Number(i) + 1} · {remaining(Number(i)) <= 0 ? "time's up" : clock(remaining(Number(i)))}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: spacing.lg, flexGrow: 1, justifyContent: "center" }}>
        <Text style={{ fontSize: 28, lineHeight: 38, fontWeight: "600", color: colors.text }}>{step.text}</Text>

        {step.timerSeconds ? (
          <View style={{ marginTop: spacing.xl, alignItems: "center", gap: spacing.md }}>
            <Text style={{ fontSize: 56, fontWeight: "700", color: done ? colors.danger : colors.text, fontVariant: ["tabular-nums"] }}>
              {done ? "Time's up" : clock(left)}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {timer?.endsAt != null && !done ? (
                <Pressable onPress={pause} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.primary }}>Pause</Text>
                </Pressable>
              ) : !done ? (
                <Pressable onPress={start} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.primary }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.background }}>{timer ? "Resume" : "Start timer"}</Text>
                </Pressable>
              ) : null}
              {timer ? (
                <Pressable onPress={reset} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.textMuted }}>Reset</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: spacing.md, padding: spacing.lg }}>
        {navButton("Back", () => setIndex(index - 1), false, index === 0)}
        {navButton(last ? "Done" : "Next", () => (last ? router.back() : setIndex(index + 1)), true)}
      </View>
    </SafeAreaView>
  );
}
