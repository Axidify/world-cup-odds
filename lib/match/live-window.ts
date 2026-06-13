import { getResolvedMatches } from "@/lib/data/resolved";
import { getMatchLifecycle } from "@/lib/match/lifecycle";
import { getResult } from "@/lib/results/store";
import type { Match } from "@/lib/types";

/** Fixtures currently in the kickoff → ~2h post-kickoff live window (not yet confirmed). */
export function listMatchesInLiveWindow(now = Date.now()): Match[] {
  return getResolvedMatches().filter((match) => {
    if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") return false;
    if (getResult(match.id)?.confirmed) return false;
    return getMatchLifecycle(match.date, false, now) === "live";
  });
}

/** Ms until the next fixture enters the live window, or null if none scheduled. */
export function msUntilNextLiveWindow(now = Date.now()): number | null {
  let next: number | null = null;

  for (const match of getResolvedMatches()) {
    if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") continue;
    if (getResult(match.id)?.confirmed) continue;

    const kickoff = new Date(match.date).getTime();
    if (kickoff <= now) continue;

    next = next == null ? kickoff : Math.min(next, kickoff);
  }

  return next;
}
