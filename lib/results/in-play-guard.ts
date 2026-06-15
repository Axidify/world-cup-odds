import { isLiveFootballDataStatus } from "@/lib/results/football-data/client";
import { getLiveScore } from "@/lib/results/live-scores/store";

/** True when our live-scores row says football-data still has the match in play. */
export function isFixtureInPlayOnLiveFeed(matchId: string): boolean {
  const live = getLiveScore(matchId);
  if (!live) return false;
  return isLiveFootballDataStatus(live.status ?? undefined);
}
