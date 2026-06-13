import type { Match } from "@/lib/types";
import { applyFinishedResultsToTargets } from "@/lib/results/apply-finished";
import { fetchWc2026Matches, isFinishedStatus } from "./client";
import { indexFinishedBigBallsMatches } from "./sync";

export async function pollResultsFromBigBalls(
  targets: Match[],
): Promise<{ confirmed: number; synced: number; failed: number }> {
  if (targets.length === 0) {
    return { confirmed: 0, synced: 0, failed: 0 };
  }

  let apiMatches;
  try {
    apiMatches = await fetchWc2026Matches({ status: "finished" });
  } catch (err) {
    console.warn("[poller] big-balls:", err instanceof Error ? err.message : err);
    return { confirmed: 0, synced: 0, failed: targets.length };
  }

  const finishedByMatchId = indexFinishedBigBallsMatches(apiMatches, targets);
  const finishedInApi = apiMatches.filter((m) => isFinishedStatus(m.status)).length;

  if (targets.length > 0 && finishedByMatchId.size === 0) {
    console.warn(
      `[poller] big-balls: ${targets.length} target(s), ${finishedInApi} finished in API, 0 linked to fixtures`,
    );
  }

  return applyFinishedResultsToTargets(targets, finishedByMatchId);
}
