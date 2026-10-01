// Splitting a cost between housemates — integer cents, and the parts always add up to
// exactly the total. Each person's share is proportional to their weight (costShare:
// 1 = a normal share, 2 = double, 0 = not paying). Cents that don't divide evenly go
// one each to the largest remainders, ties to whoever is listed first.

export interface SplitShare {
  id: string;
  weight: number;
}

export function splitCents(totalCents: number, shares: SplitShare[]): Record<string, number> {
  const totalWeight = shares.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) throw new Error("splitCents: at least one person must have a share above 0");

  const exact = shares.map((s) => (totalCents * s.weight) / totalWeight);
  const result = shares.map((s, i) => ({ id: s.id, cents: Math.floor(exact[i]!), remainder: exact[i]! - Math.floor(exact[i]!), order: i }));
  let leftover = totalCents - result.reduce((sum, r) => sum + r.cents, 0);
  for (const r of [...result].sort((a, b) => b.remainder - a.remainder || a.order - b.order)) {
    if (leftover <= 0) break;
    r.cents += 1;
    leftover -= 1;
  }
  return Object.fromEntries(result.map((r) => [r.id, r.cents]));
}
