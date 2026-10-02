import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { Chip } from "@/components/ui/Chip";
import { PressableScale } from "@/components/ui/PressableScale";
import { useTheme } from "@/theme";

// Small building blocks shared by the welcome, profile setup, and profile screens.

export function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...typography.heading, color: colors.text, marginBottom: hint ? spacing.xs : spacing.sm }}>{title}</Text>
      {hint ? <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm }}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function ChipRow({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {options.map((option) => (
        <Chip key={option} label={option.replace(/_/g, " ")} selected={selected.includes(option)} onPress={() => onToggle(option)} />
      ))}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={{
        borderRadius: radius.md,
        borderCurve: "continuous",
        padding: spacing.md,
        color: colors.text,
        backgroundColor: colors.backgroundMuted,
        marginBottom: spacing.md,
      }}
    />
  );
}

type Variant = "primary" | "outline" | "danger" | "neutral";

function useVariant(variant: Variant) {
  const { colors } = useTheme();
  return {
    primary: { box: { backgroundColor: colors.brandAccent }, text: colors.onBrandAccent },
    outline: { box: { backgroundColor: colors.accentTint }, text: colors.brandAccent },
    neutral: { box: { backgroundColor: colors.backgroundMuted }, text: colors.text },
    danger: { box: { backgroundColor: colors.backgroundMuted }, text: colors.criticalError },
  }[variant];
}

/** Full-width action. */
export function Button({ label, onPress, disabled, variant = "primary" }: { label: string; onPress: () => void; disabled?: boolean; variant?: Variant }) {
  const { spacing, radius, typography, minTouch } = useTheme();
  const look = useVariant(variant);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      aria-disabled={!!disabled}
      style={[
        look.box,
        {
          minHeight: minTouch + spacing.sm,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          borderRadius: radius.pill,
          opacity: disabled ? 0.6 : 1,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <Text style={{ ...typography.bodyStrong, color: look.text }}>{label}</Text>
    </PressableScale>
  );
}

/** Compact action, still at least minTouch in both directions. */
export function Pill({ label, onPress, disabled, variant = "outline", accessibilityLabel }: { label: string; onPress: () => void; disabled?: boolean; variant?: Variant; accessibilityLabel?: string }) {
  const { spacing, radius, typography, minTouch } = useTheme();
  const look = useVariant(variant);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        look.box,
        { minHeight: minTouch, minWidth: minTouch, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Text style={{ ...typography.caption, color: look.text }}>{label}</Text>
    </PressableScale>
  );
}

/** Inline text action with a full-size touch target. */
export function TextLink({ label, onPress, align = "auto" }: { label: string; onPress: () => void; align?: "auto" | "center" }) {
  const { colors, typography, minTouch } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={{ minHeight: minTouch, minWidth: minTouch, justifyContent: "center", alignSelf: align === "center" ? "center" : "flex-start" }}>
      <Text style={{ ...typography.caption, color: colors.brandAccent, textAlign: align === "center" ? "center" : "left" }}>{label}</Text>
    </Pressable>
  );
}
