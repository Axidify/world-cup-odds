import type { GroupStanding, PlayedMatchResult, Team } from "@/lib/types";

function emptyStanding(teamId: string, group: string): GroupStanding {
  return {
    teamId,
    group,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    position: 0,
  };
}

export function applyGroupResult(
  standings: Map<string, GroupStanding>,
  result: PlayedMatchResult,
): void {
  const home = standings.get(result.homeTeamId);
  const away = standings.get(result.awayTeamId);
  if (!home || !away) return;

  home.played += 1;
  away.played += 1;
  home.goalsFor += result.homeGoals;
  home.goalsAgainst += result.awayGoals;
  away.goalsFor += result.awayGoals;
  away.goalsAgainst += result.homeGoals;

  if (result.homeGoals > result.awayGoals) {
    home.won += 1;
    home.points += 3;
    away.lost += 1;
  } else if (result.homeGoals < result.awayGoals) {
    away.won += 1;
    away.points += 3;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }

  for (const s of standings.values()) {
    s.goalDifference = s.goalsFor - s.goalsAgainst;
  }
}

function headToHeadStats(
  teamIds: string[],
  results: PlayedMatchResult[],
): Map<string, { points: number; gd: number; gf: number }> {
  const stats = new Map(teamIds.map((id) => [id, { points: 0, gd: 0, gf: 0 }]));
  const set = new Set(teamIds);
  for (const r of results) {
    if (!set.has(r.homeTeamId) || !set.has(r.awayTeamId)) continue;
    const h = stats.get(r.homeTeamId)!;
    const a = stats.get(r.awayTeamId)!;
    h.gf += r.homeGoals;
    a.gf += r.awayGoals;
    h.gd += r.homeGoals - r.awayGoals;
    a.gd += r.awayGoals - r.homeGoals;
    if (r.homeGoals > r.awayGoals) h.points += 3;
    else if (r.homeGoals < r.awayGoals) a.points += 3;
    else {
      h.points += 1;
      a.points += 1;
    }
  }
  return stats;
}

function compareStandings(
  a: GroupStanding,
  b: GroupStanding,
  tiedSubset: GroupStanding[],
  groupResults: PlayedMatchResult[],
  fifaRank: Map<string, number>,
): number {
  if (tiedSubset.length <= 2) {
    const h2h = headToHeadStats(
      tiedSubset.map((t) => t.teamId),
      groupResults,
    );
    const ah = h2h.get(a.teamId)!;
    const bh = h2h.get(b.teamId)!;
    if (bh.points !== ah.points) return bh.points - ah.points;
    if (bh.gd !== ah.gd) return bh.gd - ah.gd;
    if (bh.gf !== ah.gf) return bh.gf - ah.gf;
  }
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return (fifaRank.get(a.teamId) ?? 999) - (fifaRank.get(b.teamId) ?? 999);
}

export function sortGroupStandings(
  standings: GroupStanding[],
  groupResults: PlayedMatchResult[],
  fifaRank: Map<string, number>,
): GroupStanding[] {
  const sorted = [...standings];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].points === sorted[i].points) j += 1;
    const block = sorted.slice(i, j);
    if (block.length > 1) {
      block.sort((a, b) => compareStandings(a, b, block, groupResults, fifaRank));
      sorted.splice(i, block.length, ...block);
    }
    i = j;
  }
  sorted.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return compareStandings(a, b, [a, b], groupResults, fifaRank);
  });
  return sorted.map((s, idx) => ({ ...s, position: idx + 1 }));
}

export function buildGroupStandings(
  group: string,
  teamIds: string[],
  results: PlayedMatchResult[],
): GroupStanding[] {
  const map = new Map(teamIds.map((id) => [id, emptyStanding(id, group)]));
  for (const r of results) {
    if (map.has(r.homeTeamId) && map.has(r.awayTeamId)) {
      applyGroupResult(map, r);
    }
  }
  return [...map.values()];
}

export function rankThirdPlaceTeams(
  thirdPlace: GroupStanding[],
  fifaRank: Map<string, number>,
): GroupStanding[] {
  return [...thirdPlace].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return (fifaRank.get(a.teamId) ?? 999) - (fifaRank.get(b.teamId) ?? 999);
  });
}

export function buildFifaRankMap(teams: Team[]): Map<string, number> {
  return new Map(teams.map((t) => [t.id, t.fifaRank]));
}
