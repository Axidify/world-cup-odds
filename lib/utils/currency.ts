const currency = process.env.POOL_CURRENCY ?? "MYR";

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyCompact(amount: number): string {
  const prefix = amount >= 0 ? "+" : "";
  return `${prefix}${formatMoney(Math.abs(amount))}`;
}
