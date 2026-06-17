import type { Match } from "@/lib/types";
import { getResolvedMatch } from "@/lib/data/resolved";
import { applyFinishedResultsToTargets } from "@/lib/results/apply-finished";
import {
  fetchFootballDataMatch,
  fetchWorldCupMatches,
  isFootballDataConfigured,
} from "@/lib/results/football-data/client";
import {
  enrichLinkedFinishedMatches,
  indexFinishedMatchesWithListDetailAgreement,
} from "@/lib/results/football-data/sync";
import type { FootballDataMatch } from "@/lib/results/football-data/types";
import type { ParsedFinishedWithLive } from "@/lib/results/live-snapshot";
import { applyLastLiveScoreToFinishedMap } from "@/lib/results/live-snapshot";
import {
  finalizeResultConfirmation,
  finalizeResultUnconfirmation,
} from "@/lib/results/on-confirm";
import { listAutoConfirmedResults, upsertPendingResult } from "@/lib/results/store";

let lastReconcileAt = 0;

function reconcileMinIntervalMs(): number {
  const raw = Number(process.env.FOOTBALL_DATA_RECONCILE_INTERVAL_MINUTES ?? 30);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 30;
  return minutes * 60_000;
}

export async function buildFinishedResultsMap(
  targets: Match[],
  apiMatches: FootballDataMatch[],
): Promise<Map<string, ParsedFinishedWithLive>> {
  const enriched = await enrichLinkedFinishedMatches(
    apiMatches,
    targets,
    fetchFootballDataMatch,
  );
  const finishedByMatchId = indexFinishedMatchesWithListDetailAgreement(
    apiMatches,
    enriched,
    targets,
  );

  const withApiFlag = new Map(
    [...finishedByMatchId.entries()].map(([id, parsed]) => [
      id,
      { ...parsed, apiFinished: true },
    ]),
  );

  return applyLastLiveScoreToFinishedMap(withApiFlag);
}

export async function processFootballDataFinishedTargets(
  targets: Match[],
  apiMatches?: FootballDataMatch[],
): Promise<{
  confirmed: number;
  synced: number;
  failed: number;
  apiMatches: FootballDataMatch[] | null;
}> {
  if (targets.length === 0) {
    return { confirmed: 0, synced: 0, failed: 0, apiMatches: apiMatches ?? null };
  }

  let list = apiMatches;
  if (!list) {
    try {
      list = await fetchWorldCupMatches();
    } catch (err) {
      console.warn(
        "[poller] football-data:",
        err instanceof Error ? err.message : err,
      );
      return { confirmed: 0, synced: 0, failed: targets.length, apiMatches: null };
    }
  }

  const withLive = await buildFinishedResultsMap(targets, list);
  const finishedInApi = list.filter((m) => m.status === "FINISHED").length;

  if (targets.length > 0 && withLive.size === 0) {
    console.warn(
      `[poller] football-data: ${targets.length} target(s), ${finishedInApi} FINISHED in API, 0 linked to fixtures`,
    );
  }

  const summary = applyFinishedResultsToTargets(targets, withLive);
  return { ...summary, apiMatches: list };
}

export async function pollResultsFromFootballData(
  targets: Match[],
  apiMatches?: FootballDataMatch[],
): Promise<{ confirmed: number; synced: number; failed: number }> {
  const result = await processFootballDataFinishedTargets(targets, apiMatches);
  return {
    confirmed: result.confirmed,
    synced: result.synced,
    failed: result.failed,
  };
}

/** Re-fetch football-data scores for auto-confirmed results and fix stale goal lines. */
export async function reconcileFootballDataConfirmedResults(
  options: { force?: boolean; apiMatches?: FootballDataMatch[] } = {},
): Promise<number> {
  if (!isFootballDataConfigured()) return 0;

  const now = Date.now();
  if (!options.force && now - lastReconcileAt < reconcileMinIntervalMs()) {
    return 0;
  }

  const rows = listAutoConfirmedResults();
  if (rows.length === 0) return 0;

  let apiMatches = options.apiMatches;
  if (!apiMatches) {
    try {
      apiMatches = await fetchWorldCupMatches();
    } catch (err) {
      console.warn(
        "[poller] football-data reconcile:",
        err instanceof Error ? err.message : err,
      );
      return 0;
    }
  }

  lastReconcileAt = now;

  const localMatches = rows
    .map((row) => getResolvedMatch(row.matchId))
    .filter((match): match is Match => match != null);

  const withLive = await buildFinishedResultsMap(localMatches, apiMatches);

  let fixed = 0;
  for (const row of rows) {
    const parsed = withLive.get(row.matchId);
    if (!parsed) continue;
    if (row.homeScore === parsed.homeScore && row.awayScore === parsed.awayScore) continue;

    console.log(
      `[poller] football-data: reconciling ${row.matchId} ${row.homeScore}-${row.awayScore} -> ${parsed.homeScore}-${parsed.awayScore}`,
    );

    if (!finalizeResultUnconfirmation(row.matchId)) continue;

    upsertPendingResult({
      matchId: row.matchId,
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
      et: parsed.et,
      pens: parsed.pens,
      winnerTeamId: parsed.winnerTeamId,
      source: parsed.source,
    });

    if (finalizeResultConfirmation(row.matchId, "auto")) {
      fixed += 1;
    }
  }

  return fixed;
}
