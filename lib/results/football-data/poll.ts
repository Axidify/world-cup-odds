import type { Match } from "@/lib/types";
import { applyFinishedResultsToTargets } from "@/lib/results/apply-finished";
import { fetchWorldCupMatches } from "@/lib/results/football-data/client";
import { indexFinishedMatches } from "@/lib/results/football-data/sync";

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

  const finishedByMatchId = indexFinishedMatches(apiMatches, targets);
  const finishedInApi = apiMatches.filter((m) => m.status === "FINISHED").length;

  if (targets.length > 0 && finishedByMatchId.size === 0) {
    console.warn(
      `[poller] football-data: ${targets.length} target(s), ${finishedInApi} FINISHED in API, 0 linked to fixtures`,
    );
  }

  return applyFinishedResultsToTargets(targets, finishedByMatchId);
}
