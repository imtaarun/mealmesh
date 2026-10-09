import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Button } from "./Form";
import { useTheme } from "@/theme";

/** Placeholder cards that breathe while the real ones load, with a line saying what's happening. */
export function LoadingState({ messages = ["Getting things ready…"] }: { messages?: string[] }) {
  const { colors, spacing, radius, typography } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(0.45, { duration: 900 }), -1, true);
    const rotate = setInterval(() => setLine((i) => (i + 1) % messages.length), 1800);
    return () => clearInterval(rotate);
  }, []);
  const breathing = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const block = (height: number, width: number | `${number}%` = "100%") => (
    <View style={{ height, width, borderRadius: radius.md, borderCurve: "continuous", backgroundColor: colors.backgroundMuted }} />
  );

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={messages[line]}>
      <Animated.Text key={line} entering={FadeIn.duration(300)} style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.md }}>
        {messages[line]}
      </Animated.Text>
      <Animated.View style={[{ gap: spacing.md }, breathing]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, borderCurve: "continuous", padding: spacing.md, gap: spacing.sm }}>
            {block(18, "45%")}
            {block(14, "80%")}
            {block(14, "60%")}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

/** A load that failed: the reason in plain words, and a way to try again. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md }}>
      <Text style={{ ...typography.heading, color: colors.text, textAlign: "center" }}>That didn't load.</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center" }}>{message}</Text>
      <View style={{ alignSelf: "stretch" }}>
        <Button label="Try again" variant="outline" onPress={onRetry} />
      </View>
    </View>
  );
}
