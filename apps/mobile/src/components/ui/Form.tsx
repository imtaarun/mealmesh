import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { Chip } from "@/components/ui/Chip";
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
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        color: colors.text,
        backgroundColor: colors.surface,
        marginBottom: spacing.md,
      }}
    />
  );
}

/** Full-width pill button. "outline" is the quieter, secondary look. */
export function Button({ label, onPress, disabled, variant = "primary" }: { label: string; onPress: () => void; disabled?: boolean; variant?: "primary" | "outline" | "danger" }) {
  const { colors, spacing, radius, typography } = useTheme();
  const filled = variant === "primary";
  const tint = variant === "danger" ? colors.danger : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: filled ? (pressed || disabled ? colors.primaryPressed : colors.primary) : "transparent",
        borderWidth: filled ? 0 : 1,
        borderColor: tint,
        borderRadius: radius.pill,
        paddingVertical: spacing.md,
        alignItems: "center",
        opacity: disabled && !filled ? 0.6 : 1,
        marginBottom: spacing.sm,
      })}
    >
      <Text style={{ ...typography.bodyStrong, color: filled ? colors.background : tint }}>{label}</Text>
    </Pressable>
  );
}
