import { formatQuantity, soldByCount } from "@mealmesh/domain";
import type { PantryItem } from "@/lib/api";

export function pantryAmount(item: Pick<PantryItem, "quantity" | "unit" | "category" | "gramsPerPiece">): string {
  return soldByCount(item) ? formatQuantity(item.quantity / item.gramsPerPiece!, "piece") : formatQuantity(item.quantity, item.unit);
}

export function expiryText(expiresAt: string): string {
  const date = new Date(expiresAt);
  if (date.getTime() < Date.now()) return "Expired";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires ${days < 7 ? date.toLocaleDateString(undefined, { weekday: "long" }) : date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
