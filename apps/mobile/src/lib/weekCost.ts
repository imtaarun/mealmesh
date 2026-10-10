import { splitCents } from "@mealmesh/domain";
import { api, type Housemate } from "./api";

/** The week's cost as Shop's Best overall prices it: the one figure Home, Week and Profile show. */
export async function loadWeekCost(planId: string): Promise<number> {
  const list = await api.getGroceryList(planId);
  return (await api.optimizeGroceryList(list.id)).budget.plannedCents;
}

/** Each housemate's part of that figure, by share weight; null when nobody is paying. */
export function sharesOf(totalCents: number, members: Housemate[]): Record<string, number> | null {
  return members.some((m) => m.costShare > 0) ? splitCents(totalCents, members.map((m) => ({ id: m.id, weight: m.costShare }))) : null;
}
