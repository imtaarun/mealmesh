import { useState } from "react";
import { Text, View } from "react-native";
import { TextField } from "@/components/ui/Form";
import { useTheme } from "@/theme";

const pad = (text: string) => text.padStart(2, "0");

/** Day / month / year boxes, reported as YYYY-MM-DD ("" until all three are filled). Starts empty on purpose. */
export function DateOfBirthField({ onChange }: { onChange: (dateOfBirth: string) => void }) {
  const { colors, spacing, typography } = useTheme();
  const [parts, setParts] = useState({ day: "", month: "", year: "" });

  const set = (key: keyof typeof parts) => (text: string) => {
    const next = { ...parts, [key]: text.replace(/\D/g, "") };
    setParts(next);
    onChange(next.day && next.month && next.year.length === 4 ? `${next.year}-${pad(next.month)}-${pad(next.day)}` : "");
  };

  return (
    <View>
      <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs }}>Date of birth</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField placeholder="DD" accessibilityLabel="Day of birth" keyboardType="number-pad" maxLength={2} value={parts.day} onChangeText={set("day")} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField placeholder="MM" accessibilityLabel="Month of birth" keyboardType="number-pad" maxLength={2} value={parts.month} onChangeText={set("month")} />
        </View>
        <View style={{ flex: 1.5 }}>
          <TextField placeholder="YYYY" accessibilityLabel="Year of birth" keyboardType="number-pad" maxLength={4} value={parts.year} onChangeText={set("year")} />
        </View>
      </View>
    </View>
  );
}
