import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { convertToBaseUnit, soldByCount } from "@mealmesh/domain";
import { Screen, BackLink, LoadingScreen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button, Section, TextField } from "@/components/ui/Form";
import { api, type IngredientOption, type PantryItem, type PantryLocation } from "@/lib/api";
import { expiryText } from "@/lib/pantry";
import { haptic } from "@/lib/feedback";
import { reportError, toast } from "@/components/ui/Toast";
import { useTheme } from "@/theme";

const LOCATIONS: Array<[PantryLocation, string]> = [
  ["fridge", "Fridge"],
  ["freezer", "Freezer"],
  ["pantry", "Pantry"],
];
const EXPIRY: Array<[number | null, string]> = [
  [null, "No date"],
  [3, "3 days"],
  [7, "1 week"],
  [14, "2 weeks"],
  [30, "1 month"],
];

function defaultLocation(category: string): PantryLocation {
  if (category === "Frozen") return "freezer";
  return ["Produce", "Dairy", "Meat & Seafood"].includes(category) ? "fridge" : "pantry";
}

/** Add to the pantry, or with ?id= edit or remove an item. */
export default function PantryItemScreen() {
  const { colors, spacing, typography, minTouch } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [existing, setExisting] = useState<PantryItem | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<IngredientOption | null>(null);
  const [amount, setAmount] = useState("");
  const [location, setLocation] = useState<PantryLocation>("pantry");
  // undefined keeps an existing date.
  const [expiresInDays, setExpiresInDays] = useState<number | null | undefined>(id ? undefined : null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) {
      api.listIngredients().then(setIngredients, reportError);
      return;
    }
    api.getPantry().then(({ items }) => {
      const item = items.find((i) => i.id === id)!;
      const ingredient = { id: item.ingredientId, name: item.name, category: item.category, baseUnit: item.unit, gramsPerPiece: item.gramsPerPiece };
      setExisting(item);
      setPicked(ingredient);
      setAmount(String(Math.round((soldByCount(ingredient) ? item.quantity / item.gramsPerPiece! : item.quantity) * 100) / 100));
      setLocation(item.location);
      setExpiresInDays(item.expiresAt ? undefined : null);
    }, reportError);
  }, [id]);

  if (id && !existing) return <LoadingScreen back="Pantry" />;

  const pick = (ingredient: IngredientOption) => {
    setPicked(ingredient);
    setLocation(defaultLocation(ingredient.category));
    setAmount(soldByCount(ingredient) ? "1" : "");
  };

  if (!picked) {
    const q = query.trim().toLowerCase();
    const matches = q ? ingredients.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8) : [];
    return (
      <Screen>
        <BackLink label="Pantry" />
        <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Add to your pantry</Text>
        <TextField placeholder="Search ingredients" value={query} onChangeText={setQuery} autoFocus />
        {matches.length > 0 ? (
          <Card style={{ paddingVertical: spacing.xs }}>
            {matches.map((ingredient) => (
              <Pressable key={ingredient.id} onPress={() => pick(ingredient)} accessibilityRole="button" style={{ minHeight: minTouch, justifyContent: "center" }}>
                <Text style={{ ...typography.body, color: colors.text }}>{ingredient.name}</Text>
              </Pressable>
            ))}
          </Card>
        ) : q ? (
          <Text style={{ ...typography.body, color: colors.textMuted }}>Nothing called "{query.trim()}" yet.</Text>
        ) : null}
      </Screen>
    );
  }

  const counted = soldByCount(picked);
  const value = Number(amount);
  const valid = amount.trim() !== "" && Number.isFinite(value) && value > 0;

  const save = async () => {
    setSaving(true);
    const quantity = counted ? convertToBaseUnit({ value, unit: "piece" }, { id: picked.id, baseUnit: "g", gramsPerPiece: picked.gramsPerPiece! }).value : value;
    const expiresAt = expiresInDays == null ? expiresInDays : new Date(Date.now() + expiresInDays * 86_400_000).toISOString();
    try {
      if (existing) await api.updatePantryItem(existing.id, { quantity, location, expiresAt });
      else await api.addPantryItem({ ingredientId: picked.id, quantity, location, ...(expiresAt ? { expiresAt } : {}) });
      haptic.success();
      toast(existing ? `${picked.name} updated.` : `${picked.name} is in your pantry.`);
      router.back();
    } catch (err) {
      reportError(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.removePantryItem(existing!.id);
      toast(`${existing!.name} removed.`);
      router.back();
    } catch (err) {
      reportError(err);
    }
  };

  return (
    <Screen>
      <BackLink label="Pantry" />
      <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.lg }}>{picked.name}</Text>

      <Section title="How much">
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount" accessibilityLabel={`Amount in ${counted ? "pieces" : picked.baseUnit}`} />
          </View>
          <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.md }}>{counted || picked.baseUnit === "piece" ? "pieces" : picked.baseUnit}</Text>
        </View>
      </Section>

      <Section title="Where">
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {LOCATIONS.map(([value, label]) => (
            <Chip key={value} label={label} selected={location === value} onPress={() => setLocation(value)} />
          ))}
        </View>
      </Section>

      <Section title="Use by" hint={expiresInDays === undefined ? expiryText(existing!.expiresAt!) : undefined}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {EXPIRY.map(([days, label]) => (
            <Chip key={label} label={label} selected={expiresInDays === days} onPress={() => setExpiresInDays(days)} />
          ))}
        </View>
      </Section>

      <Button label={saving ? "Saving…" : existing ? "Save" : "Add to pantry"} disabled={!valid || saving} onPress={save} />
      {existing ? <Button label="Remove from pantry" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}
