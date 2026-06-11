import {
  buildR32Pairings,
  collectQualifiedThirdGroups,
  resolveKnockoutTeams,
} from "@/lib/bracket";
import {
  getBracketTemplate,
  getFixtures,
  getKnockoutFixtures,
  getTeams,
} from "@/lib/data/load";
import { buildOfficialStandingsByGroup } from "@/lib/standings/official-standings";
import { buildFifaRankMap, rankThirdPlaceTeams } from "@/lib/standings";
import type { GroupStanding, MatchStage, PlayedMatchResult } from "@/lib/types";

const KNOCKOUT_ORDER: MatchStage[] = ["r32", "r16", "qf", "sf", "third_place", "final"];

export type OfficialBracketMatch = {
  matchId: string;
  stage: MatchStage;
  homeTeamId: string;
  awayTeamId: string;
  winnerTeamId?: string;
};

export type OfficialKnockoutPath = {
  knockout: OfficialBracketMatch[];
  championTeamId?: string;
  groupsComplete: boolean;
  hasConfirmedKnockoutResults: boolean;
};

function winnerFromResult(
  result: PlayedMatchResult,
  homeTeamId: string,
  awayTeamId: string,
): string | undefined {
  if (result.winnerTeamId) return result.winnerTeamId;
  if (result.homeGoals > result.awayGoals) return homeTeamId;
  if (result.awayGoals > result.homeGoals) return awayTeamId;
  return undefined;
}

export function buildOfficialKnockoutPath(
  confirmed: Map<string, PlayedMatchResult>,
): OfficialKnockoutPath {
  const groupFixtures = getFixtures();
  const groupsComplete = groupFixtures.every((f) => confirmed.has(f.id));
  const knockout = getKnockoutFixtures();
  const hasConfirmedKnockoutResults = knockout.some((m) => confirmed.has(m.id));

  const winners = new Map<string, string>();
  const losers = new Map<string, string>();
  const path: OfficialBracketMatch[] = [];

  const r32Pairings = new Map<string, { homeTeamId: string; awayTeamId: string }>();
  if (groupsComplete) {
    const standingsByGroup = buildOfficialStandingsByGroup(confirmed);
    const thirdRows = Object.values(standingsByGroup)
      .map((rows) => rows[2])
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const fifa = buildFifaRankMap(getTeams());
    const rankedThird = rankThirdPlaceTeams(thirdRows, fifa);
    const qualifiedThirdGroups = collectQualifiedThirdGroups(rankedThird);
    const thirdByGroup: Record<string, GroupStanding> = {};
    for (const [group, rows] of Object.entries(standingsByGroup)) {
      if (rows[2]) thirdByGroup[group] = rows[2];
    }
    const template = getBracketTemplate();
    for (const pairing of buildR32Pairings(
      template,
      standingsByGroup,
      qualifiedThirdGroups,
      thirdByGroup,
    )) {
      r32Pairings.set(pairing.matchId, pairing);
    }
  }

  const ordered = [...knockout].sort(
    (a, b) => KNOCKOUT_ORDER.indexOf(a.stage) - KNOCKOUT_ORDER.indexOf(b.stage),
  );

  for (const match of ordered) {
    let homeTeamId: string | undefined;
    let awayTeamId: string | undefined;

    if (match.stage === "r32") {
      const pairing = r32Pairings.get(match.id);
      if (pairing) {
        homeTeamId = pairing.homeTeamId;
        awayTeamId = pairing.awayTeamId;
      }
    } else {
      try {
        const resolved = resolveKnockoutTeams(match, winners, losers);
        homeTeamId = resolved.homeTeamId;
        awayTeamId = resolved.awayTeamId;
      } catch {
        // Teams not yet known from confirmed results.
      }
    }

    const result = confirmed.get(match.id);
    if (homeTeamId && awayTeamId && result) {
      const winner = winnerFromResult(result, homeTeamId, awayTeamId);
      if (winner) {
        winners.set(match.id, winner);
        losers.set(match.id, winner === homeTeamId ? awayTeamId : homeTeamId);
      }
    }

    if (homeTeamId && awayTeamId) {
      path.push({
        matchId: match.id,
        stage: match.stage,
        homeTeamId,
        awayTeamId,
        winnerTeamId: winners.get(match.id),
      });
    }
  }

  const final = path.find((entry) => entry.stage === "final" && entry.winnerTeamId);

  return {
    knockout: path,
    championTeamId: final?.winnerTeamId,
    groupsComplete,
    hasConfirmedKnockoutResults,
  };
}
