import { getResolvedMatches } from "@/lib/data/resolved";
import type { Match } from "@/lib/types";
import { isUpcomingKickoff } from "@/lib/match/dashboard-upcoming";

/** Earliest future kickoff(s); all matches sharing that kickoff time. */
export function getNextUpcomingMatches(now = Date.now()): Match[] {
  const upcoming = getResolvedMatches()
    .filter((m) => m.homeTeamId !== "TBD" && m.awayTeamId !== "TBD")
    .filter((m) => isUpcomingKickoff(m.date, now))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcoming.length === 0) return [];

  const nextKickoff = upcoming[0].date;
  return upcoming.filter((m) => m.date === nextKickoff);
}
