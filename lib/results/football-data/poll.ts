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
import {
  finalizeResultConfirmation,
  finalizeResultUnconfirmation,
} from "@/lib/results/on-confirm";
import { listAutoConfirmedResults, upsertPendingResult } from "@/lib/results/store";

export async function pollResultsFromFootballData(
  targets: Match[],
): Promise<{ confirmed: number; synced: number; failed: number }> {
  if (targets.length === 0) {
    return { confirmed: 0, synced: 0, failed: 0 };
  }

  let apiMatches;
  try {
    apiMatches = await fetchWorldCupMatches();
  } catch (err) {
    console.warn(
      "[poller] football-data:",
      err instanceof Error ? err.message : err,
    );
    return { confirmed: 0, synced: 0, failed: targets.length };
  }

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
  const finishedInApi = apiMatches.filter((m) => m.status === "FINISHED").length;

  if (targets.length > 0 && finishedByMatchId.size === 0) {
    console.warn(
      `[poller] football-data: ${targets.length} target(s), ${finishedInApi} FINISHED in API, 0 linked to fixtures`,
    );
  }

  return applyFinishedResultsToTargets(targets, finishedByMatchId);
}

/** Re-fetch football-data scores for auto-confirmed results and fix stale goal lines. */
export async function reconcileFootballDataConfirmedResults(): Promise<number> {
  if (!isFootballDataConfigured()) return 0;

  const rows = listAutoConfirmedResults();
  if (rows.length === 0) return 0;

  let apiMatches;
  try {
    apiMatches = await fetchWorldCupMatches();
  } catch (err) {
    console.warn(
      "[poller] football-data reconcile:",
      err instanceof Error ? err.message : err,
    );
    return 0;
  }

  const localMatches = rows
    .map((row) => getResolvedMatch(row.matchId))
    .filter((match): match is Match => match != null);

  const enriched = await enrichLinkedFinishedMatches(
    apiMatches,
    localMatches,
    fetchFootballDataMatch,
  );
  const finishedByMatchId = indexFinishedMatchesWithListDetailAgreement(
    apiMatches,
    enriched,
    localMatches,
  );

  let fixed = 0;
  for (const row of rows) {
    const parsed = finishedByMatchId.get(row.matchId);
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
