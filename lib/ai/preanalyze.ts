import { sortTeamPair } from "@/lib/ai/cache-key";
import { isPredictionExpired } from "@/lib/ai/cache-ttl";
import { getPredictionForPair } from "@/lib/ai/predictions";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { getAllMatches, getFixtures, getTeams } from "@/lib/data/load";
import { getResolvedMatch } from "@/lib/data/resolved";
import type { MissingPairing } from "@/lib/types";
import { collectMissingPairings } from "@/lib/sim/gap-analysis";
import { getConfirmedResults } from "@/lib/sim/actual-results";
import { loadPredictionStore } from "@/lib/sim/prediction-store";
import { listStalePredictionRows } from "@/lib/predictions/lookup";
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

function gapPairLabel(g: MissingPairing): string {
  return `${g.homeTeamId} vs ${g.awayTeamId} (${g.stage})`;
}

function isConfirmedKnockoutPairing(
  teamA: string,
  teamB: string,
  confirmed: Map<string, unknown>,
): boolean {
  for (const matchId of confirmed.keys()) {
    const m = getResolvedMatch(matchId);
    if (!m || m.stage === "group") continue;
    if (
      (m.homeTeamId === teamA && m.awayTeamId === teamB) ||
      (m.homeTeamId === teamB && m.awayTeamId === teamA)
    ) {
      return true;
    }
  }
  return false;
}

/** Knockout bracket gaps carry resolved teams but fixtures may still be TBD — use pair analysis. */
export function workItemForGap(g: MissingPairing): BulkWorkItem {
  if (g.matchId) {
    const fx = getResolvedMatch(g.matchId);
    if (fx && fx.homeTeamId !== "TBD" && fx.awayTeamId !== "TBD") {
      return { kind: "match", matchId: g.matchId, label: gapPairLabel(g) };
    }
  }
  return {
    kind: "pair",
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    stage: g.stage,
    label: gapPairLabel(g),
  };
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
    const gaps = collectMissingPairings(store, provider, confirmed);
    for (const g of gaps) {
      const key = pairKey(g.homeTeamId, g.awayTeamId, g.stage);
      if (seen.has(key)) continue;
      if (isCached(g.homeTeamId, g.awayTeamId, g.stage, provider, refresh)) continue;
      seen.add(key);
      queue.push(workItemForGap(g));
    }
  }

  return queue;
}

/** Pairings marked stale in DB — for re-analyze before auto-sim. */
export function buildStaleAnalyzeQueue(): BulkWorkItem[] {
  const provider = resolveActiveProvider();
  if (!provider) return [];

  const staleRows = listStalePredictionRows(provider);
  const confirmed = getConfirmedResults();
  const seen = new Set<string>();
  const queue: BulkWorkItem[] = [];

  for (const row of staleRows) {
    const key = pairKey(row.teamA, row.teamB, row.stage);
    if (seen.has(key)) continue;
    seen.add(key);

    const groupMatch = getFixtures().find(
      (m) =>
        m.stage === "group" &&
        m.homeTeamId !== "TBD" &&
        m.awayTeamId !== "TBD" &&
        ((m.homeTeamId === row.teamA && m.awayTeamId === row.teamB) ||
          (m.homeTeamId === row.teamB && m.awayTeamId === row.teamA)),
    );

    if (groupMatch) {
      if (confirmed.has(groupMatch.id)) continue;
      queue.push({
        kind: "match",
        matchId: groupMatch.id,
        label: `${row.teamA} vs ${row.teamB} (group, stale)`,
      });
      continue;
    }

    if (row.stage === KNOCKOUT_PRECACHE_STAGE) {
      if (isConfirmedKnockoutPairing(row.teamA, row.teamB, confirmed)) continue;
    } else {
      const knockoutMatch = getAllMatches().find(
        (m) =>
          m.stage === row.stage &&
          m.homeTeamId !== "TBD" &&
          m.awayTeamId !== "TBD" &&
          ((m.homeTeamId === row.teamA && m.awayTeamId === row.teamB) ||
            (m.homeTeamId === row.teamB && m.awayTeamId === row.teamA)),
      );
      if (knockoutMatch && confirmed.has(knockoutMatch.id)) continue;
    }

    queue.push({
      kind: "pair",
      homeTeamId: row.teamA,
      awayTeamId: row.teamB,
      stage: row.stage,
      label: `${row.teamA} vs ${row.teamB} (${row.stage}, stale)`,
    });
  }

  return queue;
}

export function countBulkTargets(refresh = false): {
  total: number;
  cached: number;
  remaining: number;
  /** Uncached group fixtures + top-24 knockout pairings (excludes bracket-path gaps). */
  baselineMissing: number;
} {
  const pairCount = buildTop24Pairings().length;
  const provider = resolveActiveProvider();
  const confirmed = getConfirmedResults();
  const groupCount = getFixtures().filter(
    (m) =>
      m.homeTeamId !== "TBD" &&
      m.awayTeamId !== "TBD" &&
      !confirmed.has(m.id),
  ).length;
  const total = groupCount + pairCount;

  if (!provider) {
    return { total, cached: 0, remaining: total, baselineMissing: total };
  }

  const baselineMissing = buildBulkAnalyzeQueue({ refresh, includeGaps: false }).length;
  const remaining = buildBulkAnalyzeQueue({ refresh, includeGaps: true }).length;
  const cached = refresh ? 0 : Math.max(0, total - baselineMissing);
  return { total, cached, remaining, baselineMissing };
}
