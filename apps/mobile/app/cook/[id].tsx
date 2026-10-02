import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, Vibration, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { api, type RecipeDetail } from "@/lib/api";
import { Button, Pill } from "@/components/ui/Form";
import { Glass } from "@/components/ui/Glass";
import { useTheme } from "@/theme";

// Timers keep running across steps.

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
  const { colors, spacing, typography } = useTheme();
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
        <ActivityIndicator color={colors.brandAccent} />
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

  const otherTimers = running.filter(([i]) => Number(i) !== index);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg }}>
        <Text style={{ ...typography.label, color: colors.textMuted }}>
          STEP {index + 1} OF {steps.length}
        </Text>
        <Pill label="✕" variant="neutral" accessibilityLabel="Leave cooking mode" onPress={() => router.back()} />
      </View>

      {otherTimers.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {otherTimers.map(([i]) => (
            <Pill
              key={i}
              variant={remaining(Number(i)) <= 0 ? "danger" : "neutral"}
              label={`⏱ Step ${Number(i) + 1} · ${remaining(Number(i)) <= 0 ? "time's up" : clock(remaining(Number(i)))}`}
              onPress={() => setIndex(Number(i))}
            />
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: spacing.lg, flexGrow: 1, justifyContent: "center" }}>
        <Text style={{ fontSize: 28, lineHeight: 38, fontWeight: "600", color: colors.text }}>{step.text}</Text>

        {step.timerSeconds ? (
          <View style={{ marginTop: spacing.xl, alignItems: "center", gap: spacing.md }}>
            <Text style={{ fontSize: 56, fontWeight: "700", color: done ? colors.criticalError : colors.text, fontVariant: ["tabular-nums"] }}>
              {done ? "Time's up" : clock(left)}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {timer?.endsAt != null && !done ? (
                <Pill label="Pause" onPress={pause} />
              ) : !done ? (
                <Pill label={timer ? "Resume" : "Start timer"} variant="primary" onPress={start} />
              ) : null}
              {timer ? (
                <Pill label="Reset" variant="neutral" onPress={reset} />
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Glass style={{ flexDirection: "row", gap: spacing.sm, margin: spacing.md, padding: spacing.sm, paddingBottom: 0 }}>
        <View style={{ flex: 1 }}>
          <Button label="Back" variant="neutral" disabled={index === 0} onPress={() => setIndex(index - 1)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={last ? "Done" : "Next"} onPress={() => (last ? router.back() : setIndex(index + 1))} />
        </View>
      </Glass>
    </SafeAreaView>
  );
}
