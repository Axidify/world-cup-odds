import type { Match, PlayedMatchResult } from "@/lib/types";
import { getAllMatches } from "@/lib/data/load";
import { buildOfficialKnockoutPath } from "@/lib/bracket/official-knockout";
import { getConfirmedResults } from "@/lib/sim/actual-results";

/**
 * Resolved-match layer: overlays officially-determined knockout teams
 * (derived from confirmed results) onto the static fixture data, so the
 * poller, betting, analysis, and match pages see real teams instead of
 * "TBD" once the group stage / earlier rounds finish.
 */

let cache: { key: string; matches: Match[]; byId: Map<string, Match> } | null = null;

function confirmedSignature(confirmed: Map<string, PlayedMatchResult>): string {
  const parts: string[] = [];
  for (const [matchId, r] of confirmed) {
    parts.push(`${matchId}:${r.homeGoals}-${r.awayGoals}:${r.winnerTeamId ?? ""}`);
  }
  return parts.sort().join("|");
}

export function getResolvedMatches(): Match[] {
  const confirmed = getConfirmedResults();
  const key = confirmedSignature(confirmed);
  if (cache?.key === key) return cache.matches;

  const official = buildOfficialKnockoutPath(confirmed);
  const resolvedTeams = new Map(official.knockout.map((m) => [m.matchId, m]));

  const matches = getAllMatches().map((m) => {
    const resolved = resolvedTeams.get(m.id);
    if (!resolved) return m;
    return { ...m, homeTeamId: resolved.homeTeamId, awayTeamId: resolved.awayTeamId };
  });

  cache = { key, matches, byId: new Map(matches.map((m) => [m.id, m])) };
  return matches;
}

export function getResolvedMatch(id: string): Match | undefined {
  getResolvedMatches();
  return cache?.byId.get(id);
}
