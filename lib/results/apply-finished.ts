import type { Match } from "@/lib/types";
import { finalizeResultConfirmation } from "@/lib/results/on-confirm";
import { getResult, isResultConfirmable, upsertPendingResult } from "@/lib/results/store";

export type ParsedFinishedResult = {
  homeScore: number;
  awayScore: number;
  et: boolean;
  pens: boolean;
  winnerTeamId: string | null;
  source: string;
};

export function applyFinishedResultsToTargets(
  targets: Match[],
  finishedByMatchId: Map<string, ParsedFinishedResult>,
): { confirmed: number; synced: number; failed: number } {
  let confirmed = 0;
  let synced = 0;
  let failed = 0;

  for (const match of targets) {
    const parsed = finishedByMatchId.get(match.id);
    if (!parsed) continue;

    try {
      upsertPendingResult({
        matchId: match.id,
        homeScore: parsed.homeScore,
        awayScore: parsed.awayScore,
        et: parsed.et,
        pens: parsed.pens,
        winnerTeamId: parsed.winnerTeamId,
        source: parsed.source,
      });

      const row = getResult(match.id);
      if (!row || !isResultConfirmable(row)) {
        synced += 1;
        continue;
      }

      if (finalizeResultConfirmation(match.id, "auto")) {
        confirmed += 1;
      } else {
        failed += 1;
      }
    } catch (err) {
      console.warn(`[poller] results ${match.id}:`, err instanceof Error ? err.message : err);
      failed += 1;
    }
  }

  return { confirmed, synced, failed };
}
