import type { Match } from "@/lib/types";
import { shouldDeferFtResultPoll } from "@/lib/results/confirm-guards";
import { finalizeResultConfirmation } from "@/lib/results/on-confirm";
import { getResult, isResultConfirmable, upsertPendingResult } from "@/lib/results/store";

export type ParsedFinishedResult = {
  homeScore: number;
  awayScore: number;
  et: boolean;
  pens: boolean;
  winnerTeamId: string | null;
  source: string;
  /** When false, list and detail endpoints disagreed — hold pending. */
  listDetailAgree?: boolean;
  /** Last in-play snapshot agrees with (or corrected) this FT score. */
  corroboratedByLive?: boolean;
  /** football-data.org reports FINISHED for this fixture. */
  apiFinished?: boolean;
};

/** Same score must appear on two consecutive polls before auto-confirm. */
export function hasStablePendingScore(
  matchId: string,
  parsed: Pick<ParsedFinishedResult, "homeScore" | "awayScore">,
): boolean {
  const existing = getResult(matchId);
  if (!existing || existing.confirmed) return false;
  return existing.homeScore === parsed.homeScore && existing.awayScore === parsed.awayScore;
}

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

    if (shouldDeferFtResultPoll(match, Date.now(), { apiFinished: parsed.apiFinished })) {
      console.warn(
        `[poller] results ${match.id}: match still in play, ignoring FT feed`,
      );
      continue;
    }

    try {
      const scoreStable =
        hasStablePendingScore(match.id, parsed) ||
        parsed.corroboratedByLive === true ||
        parsed.listDetailAgree === true;

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

      if (parsed.listDetailAgree === false && parsed.corroboratedByLive !== true) {
        console.warn(
          `[poller] results ${match.id}: list/detail score mismatch, holding pending`,
        );
        synced += 1;
        continue;
      }

      if (!scoreStable) {
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
