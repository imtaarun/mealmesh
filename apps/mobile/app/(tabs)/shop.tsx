import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatQuantity, purchaseIncrement } from "@mealmesh/domain";
import { Screen, LoadingScreen, ErrorScreen } from "@/components/ui/Screen";
import { Appear, reorder } from "@/components/ui/Motion";
import { attempt } from "@/components/ui/Toast";
import { haptic } from "@/lib/feedback";
import { useLoad } from "@/lib/useLoad";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill, TextField } from "@/components/ui/Form";
import { WeekSummary } from "@/components/shop/WeekSummary";
import { api, type GroceryItem } from "@/lib/api";
import { useTheme } from "@/theme";

const CATEGORIES = ["Produce", "Meat & Seafood", "Dairy", "Pantry", "Frozen", "Other"];

const amount = (item: GroceryItem) => (item.isNominal ? "as needed" : formatQuantity(item.quantity, item.unit));
const covered = (item: GroceryItem) => item.alreadyHave || (item.quantity === 0 && !item.isNominal);

export default function ShopScreen() {
  const { colors, spacing, typography, minTouch } = useTheme();
  const { data: list, setData: setList, error, reload } = useLoad(async () => {
    const plan = await api.getCurrentPlan();
    return plan ? api.getGroceryList(plan.id) : null;
  });
  const [open, setOpen] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");

  const update = async (item: GroceryItem, patch: Parameters<typeof api.updateGroceryItem>[1]) => {
    const updated = await attempt(() => api.updateGroceryItem(item.id, patch));
    if (!updated) return;
    const swapIn = (items: GroceryItem[]) => items.map((i) => (i.id === updated.id ? updated : i));
    setList((l) => l && { ...l, items: swapIn(l.items) });
    if (patch.checked && list && swapIn(list.items).filter((i) => !covered(i)).every((i) => i.checked)) haptic.success();
    else haptic.tap();
  };
  const step = (item: GroceryItem, direction: 1 | -1) => {
    const by = purchaseIncrement(item.unit);
    update(item, { userOverrideQuantity: Math.max(by, item.quantity + direction * by) });
  };
  const add = async () => {
    if (!list || !newItem.trim()) return;
    const item = await attempt(() => api.addGroceryItem(list.id, newItem));
    if (!item) return;
    haptic.tap();
    setList((l) => l && { ...l, items: [...l.items, item] });
    setNewItem("");
  };
  const remove = async (item: GroceryItem) => {
    if (await attempt(() => api.removeGroceryItem(item.id))) setList((l) => l && { ...l, items: l.items.filter((i) => i.id !== item.id) });
  };

  if (error && list === undefined) return <ErrorScreen title="Shop" message={error} onRetry={reload} />;
  if (list === undefined) return <LoadingScreen title="Shop" messages={["Building your grocery list…", "Checking your pantry…", "Looking for better-value options…"]} />;
  if (list === null || list.items.length === 0) {
    return (
      <Screen>
        <Text style={{ ...typography.title, color: colors.text, marginBottom: spacing.md }}>Shop</Text>
        <EmptyState message="Your shopping list appears when your meals do." actionLabel="Plan your week" onAction={() => router.push("/week")} />
      </Screen>
    );
  }

  const toBuy = list.items.filter((i) => !covered(i));
  const have = list.items.filter(covered);
  const left = toBuy.filter((i) => !i.checked).length;

  return (
    <Screen>
      <Text style={{ ...typography.title, color: colors.text }}>Shop</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.md }}>
        {left === 0 ? "All done — everything's in the cart." : `${left} of ${toBuy.length} left to get`}
      </Text>

      {left === 0 && toBuy.length > 0 ? (
        <Appear>
          <Card style={{ alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg, backgroundColor: colors.accentTint, borderWidth: 0 }}>
            <Animated.View entering={FadeIn.delay(150).springify()}>
              <Ionicons name="checkmark-circle" size={48} color={colors.brandAccent} />
            </Animated.View>
            <Text style={{ ...typography.heading, color: colors.text }}>That's everything. Nice shop.</Text>
            <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center" }}>Put things away and tick them off in Pantry when you have a minute.</Text>
          </Card>
        </Appear>
      ) : null}

      <WeekSummary list={list} onPlanChanged={reload} />

      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField placeholder="Add an item" value={newItem} onChangeText={setNewItem} onSubmitEditing={add} returnKeyType="done" />
        </View>
        <Pill label="Add" onPress={add} disabled={!newItem.trim()} />
      </View>

      {CATEGORIES.map((category) => {
        const items = toBuy.filter((i) => i.category === category).sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name));
        if (items.length === 0) return null;
        return (
          <View key={category} style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>{category.toUpperCase()}</Text>
            <Card style={{ paddingVertical: spacing.xs }}>
              {items.map((item) => (
                <Animated.View key={item.id} layout={reorder} entering={FadeIn} exiting={FadeOut}>
                  <View style={{ flexDirection: "row", alignItems: "center", minHeight: minTouch }}>
                    <Pressable
                      onPress={() => update(item, { checked: !item.checked })}
                      accessibilityRole="checkbox"
                      aria-checked={item.checked}
                      accessibilityLabel={item.name}
                      style={{ width: minTouch, height: minTouch, justifyContent: "center", marginLeft: -spacing.sm, paddingLeft: spacing.sm }}
                    >
                      <Ionicons name={item.checked ? "checkmark-circle" : "ellipse-outline"} size={26} color={item.checked ? colors.brandAccent : colors.textMuted} />
                    </Pressable>
                    <Pressable
                      onPress={() => setOpen(open === item.id ? null : item.id)}
                      accessibilityRole="button"
                      accessibilityHint="Shows quantity and Already have"
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", minHeight: minTouch, gap: spacing.sm }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...typography.body, color: item.checked ? colors.textMuted : colors.text, textDecorationLine: item.checked ? "line-through" : "none" }}>
                          {item.name}
                        </Text>
                        {item.pantryCovered > 0 && !item.isOverridden ? (
                          <Text style={{ ...typography.caption, color: colors.success }}>{formatQuantity(item.pantryCovered, item.unit)} in your pantry</Text>
                        ) : null}
                      </View>
                      <Text style={{ ...typography.bodyStrong, color: item.checked ? colors.textMuted : colors.text }}>{amount(item)}</Text>
                    </Pressable>
                  </View>
                  {open === item.id ? (
                    <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.sm, paddingLeft: minTouch - spacing.sm }}>
                      {!item.isNominal ? (
                        <>
                          <Pill label="−" variant="neutral" accessibilityLabel={`Less ${item.name}`} onPress={() => step(item, -1)} />
                          <Pill label="+" variant="neutral" accessibilityLabel={`More ${item.name}`} onPress={() => step(item, 1)} />
                        </>
                      ) : null}
                      {item.isCustom ? (
                        <Pill label="Remove" variant="danger" accessibilityLabel={`Remove ${item.name}`} onPress={() => remove(item)} />
                      ) : (
                        <Pill label="Already have" onPress={() => update(item, { alreadyHave: true })} />
                      )}
                      {item.isOverridden ? <Pill label="Reset" variant="neutral" onPress={() => update(item, { userOverrideQuantity: null })} /> : null}
                    </Animated.View>
                  ) : null}
                </Animated.View>
              ))}
            </Card>
          </View>
        );
      })}

      {have.length > 0 ? (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>ALREADY HAVE</Text>
          <Card style={{ paddingVertical: spacing.xs }}>
            {have.map((item) => (
              <Animated.View key={item.id} layout={reorder} entering={FadeIn} style={{ flexDirection: "row", alignItems: "center", minHeight: minTouch, gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.textMuted }}>{item.name}</Text>
                  <Text style={{ ...typography.caption, color: colors.textMuted }}>{item.alreadyHave ? "You said you have it" : "Covered by your pantry"}</Text>
                </View>
                {item.alreadyHave ? (
                  <Pill label="Undo" variant="neutral" accessibilityLabel={`Put ${item.name} back on the list`} onPress={() => update(item, { alreadyHave: false })} />
                ) : (
                  <Pill label="Buy anyway" variant="neutral" onPress={() => update(item, { buyAnyway: true })} />
                )}
              </Animated.View>
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
