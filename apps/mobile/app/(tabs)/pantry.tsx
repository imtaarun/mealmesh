import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, LoadingScreen, ErrorScreen } from "@/components/ui/Screen";
import { Appear } from "@/components/ui/Motion";
import { useLoad } from "@/lib/useLoad";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextLink } from "@/components/ui/Form";
import { api } from "@/lib/api";
import { expiryText, pantryAmount } from "@/lib/pantry";
import { useTheme } from "@/theme";

const LOCATIONS = [
  { id: "fridge", label: "Fridge" },
  { id: "freezer", label: "Freezer" },
  { id: "pantry", label: "Pantry" },
] as const;

export default function PantryScreen() {
  const { colors, spacing, typography, minTouch } = useTheme();
  const { data: pantry, error, reload } = useLoad(api.getPantry);

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
      <Text style={{ ...typography.title, color: colors.text }}>Pantry</Text>
      {pantry?.items.length ? <TextLink label="Add item" onPress={() => router.push("/pantry-item")} /> : null}
    </View>
  );

  if (error && !pantry) return <ErrorScreen title="Pantry" message={error} onRetry={reload} />;
  if (!pantry) return <LoadingScreen title="Pantry" messages={["Checking the fridge…", "Looking for anything about to expire…"]} />;
  if (pantry.items.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState message="Your pantry is looking suspiciously empty." actionLabel="Add items" onAction={() => router.push("/pantry-item")} />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      {pantry.useItFirst.map((use, i) => (
        <Appear key={use.ingredientId} index={i}>
          <Card style={{ marginBottom: spacing.md, backgroundColor: colors.accentTint, borderWidth: 0 }}>
            <Text style={{ ...typography.heading, color: colors.text }}>
              Use your {use.name.toLowerCase()} soon — {use.recipeCount} {use.recipeCount === 1 ? "recipe uses" : "recipes use"} it
            </Text>
            <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs }}>{expiryText(use.expiresAt)}</Text>
            {use.recipes.map((recipe) => (
              <TextLink key={recipe.id} label={`${recipe.title} ›`} onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: recipe.id } })} />
            ))}
          </Card>
        </Appear>
      ))}

      {LOCATIONS.map(({ id, label }, section) => {
        const items = pantry.items.filter((i) => i.location === id);
        if (items.length === 0) return null;
        return (
          <Appear key={id} index={pantry.useItFirst.length + section} style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>{label.toUpperCase()}</Text>
            <Card style={{ paddingVertical: spacing.xs }}>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push({ pathname: "/pantry-item", params: { id: item.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${pantryAmount(item)}`}
                  style={{ flexDirection: "row", alignItems: "center", minHeight: minTouch, gap: spacing.sm }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.body, color: colors.text }}>{item.name}</Text>
                    {item.expiresAt ? (
                      <Text style={{ ...typography.caption, color: new Date(item.expiresAt).getTime() < Date.now() ? colors.criticalError : colors.textMuted }}>
                        {expiryText(item.expiresAt)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ ...typography.bodyStrong, color: colors.text }}>{pantryAmount(item)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </Card>
          </Appear>
        );
      })}
    </Screen>
  );
}
