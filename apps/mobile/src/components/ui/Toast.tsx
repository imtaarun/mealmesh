import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "./Glass";
import { haptic } from "@/lib/feedback";
import { messageOf } from "@/lib/useLoad";
import { useTheme } from "@/theme";

type ToastMessage = { id: number; text: string; tone: "error" | "info" };
let show: ((toast: ToastMessage) => void) | null = null;
let nextId = 0;

export function toast(text: string, tone: ToastMessage["tone"] = "info") {
  show?.({ id: nextId++, text, tone });
}

/** For actions (a tap that saves something): say what went wrong instead of failing silently. */
export function reportError(err: unknown) {
  haptic.warning();
  toast(messageOf(err), "error");
}

/** Runs an action; a failure becomes a toast and the result is undefined. */
export async function attempt<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch (err) {
    reportError(err);
    return undefined;
  }
}

/** Rendered once at the root; floats over everything. */
export function ToastHost() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastMessage | null>(null);

  useEffect(() => {
    show = setCurrent;
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const timeout = setTimeout(() => setCurrent(null), 4000);
    return () => clearTimeout(timeout);
  }, [current]);

  if (!current) return null;
  return (
    <Animated.View
      key={current.id}
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(200)}
      style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, zIndex: 10 }}
    >
      <Pressable onPress={() => setCurrent(null)} accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityHint="Dismisses this message">
        <Glass style={{ borderRadius: 24, paddingVertical: spacing.smd, paddingHorizontal: spacing.md }}>
          <Text style={{ ...typography.bodyStrong, color: current.tone === "error" ? colors.criticalError : colors.text }}>{current.text}</Text>
        </Glass>
      </Pressable>
    </Animated.View>
  );
}
