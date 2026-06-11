import { getFixtures, getGroups, getTeams } from "@/lib/data/load";
import {
  buildFifaRankMap,
  buildGroupStandings,
  sortGroupStandings,
} from "@/lib/standings";
import type { GroupStanding, PlayedMatchResult } from "@/lib/types";

export function buildOfficialStandingsByGroup(
  confirmed: Map<string, PlayedMatchResult>,
): Record<string, GroupStanding[]> {
  const groups = getGroups();
  const fixtures = getFixtures();
  const fifaRank = buildFifaRankMap(getTeams());
  const out: Record<string, GroupStanding[]> = {};

  for (const group of groups) {
    const groupMatchIds = new Set(
      fixtures.filter((f) => f.group === group.group).map((f) => f.id),
    );
    const results = [...confirmed.values()].filter((r) => groupMatchIds.has(r.matchId));
    const raw = buildGroupStandings(group.group, [...group.teamIds], results);
    out[group.group] = sortGroupStandings(raw, results, fifaRank);
  }

  return out;
}
