const DAY_MS = 86_400_000;

export function getPredictionCacheTtlMs(): number {
  const days = Number(process.env.PREDICTION_CACHE_TTL_DAYS ?? 7);
  if (!Number.isFinite(days) || days <= 0) return 7 * DAY_MS;
  return days * DAY_MS;
}

export function isPredictionExpired(generatedAt: string, now = Date.now()): boolean {
  const age = now - new Date(generatedAt).getTime();
  return age > getPredictionCacheTtlMs();
}
