import type { FootballDataMatch } from "@/lib/results/football-data/types";

let wcListCache: { fetchedAt: number; matches: FootballDataMatch[] } | null = null;

const DEFAULT_TTL_MS = 55_000;

function wcListTtlMs(): number {
  const raw = Number(process.env.FOOTBALL_DATA_LIST_CACHE_MS ?? DEFAULT_TTL_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_TTL_MS;
}

export function peekWorldCupMatchesCache(): FootballDataMatch[] | null {
  if (!wcListCache) return null;
  if (Date.now() - wcListCache.fetchedAt > wcListTtlMs()) return null;
  return wcListCache.matches;
}

export function storeWorldCupMatchesCache(matches: FootballDataMatch[]): void {
  wcListCache = { fetchedAt: Date.now(), matches };
}

export function clearWorldCupMatchesCache(): void {
  wcListCache = null;
}
