import type { Match } from "@/lib/types";
import { fetchWorldCupMatches } from "@/lib/results/football-data/client";
import { indexFinishedMatches } from "@/lib/results/football-data/sync";
import { finalizeResultConfirmation } from "@/lib/results/on-confirm";
import { getResult, isResultConfirmable, upsertPendingResult } from "@/lib/results/store";

export async function pollResultsFromFootballData(
  targets: Match[],
): Promise<{ confirmed: number; synced: number; failed: number }> {
  let confirmed = 0;
  let synced = 0;
  let failed = 0;

  if (targets.length === 0) {
    return { confirmed, synced, failed };
  }

  let apiMatches;
  try {
    apiMatches = await fetchWorldCupMatches();
  } catch (err) {
    console.warn(
      "[poller] football-data:",
      err instanceof Error ? err.message : err,
    );
    return { confirmed, synced, failed: targets.length };
  }

  const finishedByMatchId = indexFinishedMatches(apiMatches, targets);
  const finishedInApi = apiMatches.filter((m) => m.status === "FINISHED").length;

  if (targets.length > 0 && finishedByMatchId.size === 0) {
    console.warn(
      `[poller] football-data: ${targets.length} target(s), ${finishedInApi} FINISHED in API, 0 linked to fixtures`,
    );
  }

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
      console.warn(
        `[poller] football-data ${match.id}:`,
        err instanceof Error ? err.message : err,
      );
      failed += 1;
    }
  }

  return { confirmed, synced, failed };
}
