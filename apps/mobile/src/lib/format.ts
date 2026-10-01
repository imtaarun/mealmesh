export const dollars = (cents: number, decimals = 2) => `$${(cents / 100).toFixed(decimals)}`;
