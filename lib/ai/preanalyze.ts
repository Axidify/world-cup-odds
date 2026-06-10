import { sortTeamPair } from "@/lib/ai/cache-key";
import { isPredictionExpired } from "@/lib/ai/cache-ttl";
import { getPredictionForPair } from "@/lib/ai/predictions";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { getFixtures, getTeams } from "@/lib/data/load";
import { collectMissingPairings } from "@/lib/sim/gap-analysis";
import { getConfirmedResults } from "@/lib/sim/actual-results";
import { loadPredictionStore } from "@/lib/sim/prediction-store";
import type { LLMProvider } from "@/lib/types";

export type BulkWorkItem =
  | { kind: "match"; matchId: string; label: string }
  | {
      kind: "pair";
      homeTeamId: string;
      awayTeamId: string;
      stage: string;
      label: string;
    };

export const KNOCKOUT_PRECACHE_STAGE = "knockout";

function pairKey(home: string, away: string, stage: string): string {
  const [a, b] = sortTeamPair(home, away);
  return `${a}|${b}|${stage}`;
}

function isCached(
  home: string,
  away: string,
  stage: string,
  provider: LLMProvider,
  refresh: boolean,
): boolean {
  if (refresh) return false;
  const pred = getPredictionForPair(home, away, stage, provider);
  if (!pred || pred.stale === 1) return false;
  return !isPredictionExpired(pred.generatedAt);
}

export function getTop24TeamIds(): string[] {
  return [...getTeams()]
    .sort((a, b) => a.fifaRank - b.fifaRank)
    .slice(0, 24)
    .map((t) => t.id);
}

export function buildTop24Pairings(): Array<{ homeTeamId: string; awayTeamId: string }> {
  const ids = getTop24TeamIds();
  const pairs: Array<{ homeTeamId: string; awayTeamId: string }> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push({ homeTeamId: ids[i], awayTeamId: ids[j] });
    }
  }
  return pairs;
}

export function buildBulkAnalyzeQueue(options: {
  refresh?: boolean;
  includeGaps?: boolean;
} = {}): BulkWorkItem[] {
  const provider = resolveActiveProvider();
  if (!provider) return [];

  const refresh = options.refresh ?? false;
  const seen = new Set<string>();
  const queue: BulkWorkItem[] = [];
  const confirmed = getConfirmedResults();

  for (const m of getFixtures()) {
    if (confirmed.has(m.id)) continue;
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
    const key = pairKey(m.homeTeamId, m.awayTeamId, "group");
    if (seen.has(key)) continue;
    if (isCached(m.homeTeamId, m.awayTeamId, "group", provider, refresh)) continue;
    seen.add(key);
    queue.push({
      kind: "match",
      matchId: m.id,
      label: `${m.homeTeamId} vs ${m.awayTeamId} (group)`,
    });
  }

  for (const p of buildTop24Pairings()) {
    const key = pairKey(p.homeTeamId, p.awayTeamId, KNOCKOUT_PRECACHE_STAGE);
    if (seen.has(key)) continue;
    if (isCached(p.homeTeamId, p.awayTeamId, KNOCKOUT_PRECACHE_STAGE, provider, refresh)) {
      continue;
    }
    seen.add(key);
    queue.push({
      kind: "pair",
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
      stage: KNOCKOUT_PRECACHE_STAGE,
      label: `${p.homeTeamId} vs ${p.awayTeamId} (knockout)`,
    });
  }

  if (options.includeGaps !== false) {
    const store = loadPredictionStore(provider);
    const gaps = collectMissingPairings(store, provider);
    for (const g of gaps) {
      const key = pairKey(g.homeTeamId, g.awayTeamId, g.stage);
      if (seen.has(key)) continue;
      if (isCached(g.homeTeamId, g.awayTeamId, g.stage, provider, refresh)) continue;
      seen.add(key);
      if (g.matchId) {
        queue.push({
          kind: "match",
          matchId: g.matchId,
          label: `${g.homeTeamId} vs ${g.awayTeamId} (${g.stage})`,
        });
      } else {
        queue.push({
          kind: "pair",
          homeTeamId: g.homeTeamId,
          awayTeamId: g.awayTeamId,
          stage: g.stage,
          label: `${g.homeTeamId} vs ${g.awayTeamId} (${g.stage})`,
        });
      }
    }
  }

  return queue;
}

export function countBulkTargets(refresh = false): { total: number; cached: number } {
  const groupCount = getFixtures().filter(
    (m) => m.homeTeamId !== "TBD" && m.awayTeamId !== "TBD",
  ).length;
  const pairCount = buildTop24Pairings().length;
  const baseline = groupCount + pairCount;
  const provider = resolveActiveProvider();
  if (!provider) return { total: baseline, cached: 0 };
  const queue = buildBulkAnalyzeQueue({ refresh, includeGaps: false });
  return { total: baseline, cached: Math.max(0, baseline - queue.length) };
}
