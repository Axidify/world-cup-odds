/** Convert AI probability (0–100) to decimal odds, optionally applying office vig. */
export function getPoolVigPct(): number {
  const raw = Number(process.env.POOL_VIG_PCT ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(raw, 0.5));
}

export function probabilityToDecimalOdds(probabilityPct: number): number {
  if (!Number.isFinite(probabilityPct) || probabilityPct <= 0) {
    throw new Error("Probability must be greater than 0");
  }
  const fair = 100 / probabilityPct;
  const vig = getPoolVigPct();
  return roundOdds(fair * (1 - vig));
}

export function roundOdds(odds: number): number {
  return Math.round(odds * 100) / 100;
}

export function potentialPayout(stakeMyr: number, decimalOdds: number): number {
  return Math.round(stakeMyr * decimalOdds * 100) / 100;
}

export function formatDecimalOdds(odds: number): string {
  return odds.toFixed(2);
}
