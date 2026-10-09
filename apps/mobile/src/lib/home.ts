import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { api, type DealRadar, type GroceryList, type Meal, type MealPlan, type Optimization, type Pantry } from "./api";
import { dollars } from "./format";
import { expiryText } from "./pantry";

/** Dates as the plan stores them (YYYY-MM-DD), in the phone's own time zone. */
export function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface Suggestion {
  icon: ComponentProps<typeof Ionicons>["name"];
  text: string;
  href: Href;
}

export interface HomeModel {
  name: string;
  plan: MealPlan | null;
  list: GroceryList | null;
  optimization: Optimization | null;
  deals: DealRadar | null;
  pantry: Pantry;
  tomorrowCoverage: number | null; // share of tomorrow's dinner ingredients already in the pantry
}

const dinnerOn = (plan: MealPlan | null, date: string): Meal | undefined =>
  plan?.meals.find((m) => m.slot === "dinner" && m.date.slice(0, 10) === date);

export async function loadHome(): Promise<HomeModel> {
  const [me, plan, pantry] = await Promise.all([api.getMe(), api.getCurrentPlan(localDate()), api.getPantry()]);
  const tomorrow = dinnerOn(plan, localDate(1));
  const [list, recipe] = await Promise.all([
    plan ? api.getGroceryList(plan.id) : null,
    tomorrow?.type === "cook" && tomorrow.recipe ? api.getRecipe(tomorrow.recipe.id) : null,
  ]);
  const [optimization, deals] = list ? await Promise.all([api.optimizeGroceryList(list.id), api.getDeals(list.id)]) : [null, null];
  return {
    name: me.member.name,
    plan,
    list,
    optimization,
    deals,
    pantry,
    tomorrowCoverage: recipe ? recipe.pantryIngredientIds.length / recipe.ingredients.length : null,
  };
}

/** Changes with the hour and the day, so Home never opens the same way twice in a row. */
export function greeting(name: string, now = new Date()): string {
  const hour = now.getHours();
  const part = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}`;
}

export function subline(model: HomeModel, now = new Date()): string {
  const tonight = dinnerOn(model.plan, localDate());
  if (!model.plan) return "Nothing planned yet. A couple of minutes and the whole week's sorted.";
  if (tonight?.type === "leftover") return "Tonight's already cooked — it's leftovers.";
  if (tonight?.type === "eat_out") return "Night off tonight. Enjoy it.";
  const byDay = [
    "Sunday's a good day to get ahead.",
    "Fresh week. The thinking's already done.",
    "Tuesday, sorted.",
    "Halfway there.",
    "Almost the weekend.",
    "Friday. Something good tonight.",
    "Saturday — take your time.",
  ];
  return byDay[now.getDay()]!;
}

/** Only things the app can back with a number (docs/ux.md "Home screen tells a story"). */
export function suggestions(model: HomeModel): Suggestion[] {
  const out: Suggestion[] = [];

  const expiring = model.pantry.useItFirst[0];
  if (expiring) {
    const recipe = expiring.recipes[0]!;
    out.push({
      icon: "leaf-outline",
      text: `Use your ${expiring.name.toLowerCase()} — ${expiryText(expiring.expiresAt).toLowerCase()}. ${recipe.title} uses it.`,
      href: { pathname: "/recipe/[id]", params: { id: recipe.id } },
    });
  }

  const deal = model.deals?.deals[0];
  if (deal) {
    out.push({
      icon: "pricetag-outline",
      text: `${deal.item} is ${Math.round(deal.discountPercent)}% off at ${deal.store.split(" — ")[0]} — saves ${dollars(deal.savingsCents)} on this week.`,
      href: { pathname: "/deals", params: { listId: model.list!.id } },
    });
  }

  const tomorrow = dinnerOn(model.plan, localDate(1));
  if (model.tomorrowCoverage !== null && model.tomorrowCoverage >= 0.3 && tomorrow?.recipe) {
    out.push({
      icon: "checkmark-done-outline",
      text: `You already have ${Math.round(model.tomorrowCoverage * 100)}% of tomorrow's ${tomorrow.recipe.title}.`,
      href: { pathname: "/recipe/[id]", params: { id: tomorrow.recipe.id } },
    });
  }

  const lunch = model.plan?.meals.find((m) => m.slot === "lunch" && m.type === "leftover" && m.date.slice(0, 10) === localDate(1));
  if (lunch?.recipe) {
    out.push({ icon: "repeat-outline", text: `Tomorrow's lunch is already made: ${lunch.recipe.title}, from tonight.`, href: { pathname: "/recipe/[id]", params: { id: lunch.recipe.id } } });
  }

  const toBuy = model.list?.items.filter((i) => !i.alreadyHave && (i.quantity > 0 || i.isNominal)) ?? [];
  const left = toBuy.filter((i) => !i.checked).length;
  if (toBuy.length > 0) {
    out.push({
      icon: "cart-outline",
      text: left === 0 ? "Shopping's done for the week." : `${left} ${left === 1 ? "thing" : "things"} left to buy — about ${dollars(model.optimization!.budget.plannedCents, 0)} for the week.`,
      href: "/(tabs)/shop",
    });
  }

  return out.slice(0, 3);
}
