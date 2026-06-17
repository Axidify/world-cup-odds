import type { Match } from "@/lib/types";
import { getMatchLifecycle } from "@/lib/match/lifecycle";
import { isFixtureInPlayOnLiveFeed } from "@/lib/results/in-play-guard";

/** Hold FT polling while kickoff window or live feed still reports in-play. */
export function shouldDeferFtResultPoll(
  match: Match,
  now = Date.now(),
  options: { apiFinished?: boolean } = {},
): boolean {
  if (options.apiFinished) return false;
  if (getMatchLifecycle(match.date, false, now) === "live") return true;
  return isFixtureInPlayOnLiveFeed(match.id);
}
