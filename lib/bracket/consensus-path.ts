import {
  collectQualifiedThirdGroups,
} from "@/lib/bracket";
import { rankThirdPlaceTeams, buildFifaRankMap } from "@/lib/standings";
import { getTeams } from "@/lib/data/load";
import type { GroupStanding, KnockoutPathMatch, PlayedMatchResult } from "@/lib/types";
import type { PredictionStore } from "@/lib/sim/prediction-store";
import { runKnockout, type TournamentContext } from "@/lib/simulator";

export function contextFromModalStandings(
  standingsByGroup: Record<string, GroupStanding[]>,
): TournamentContext {
  const fifa = buildFifaRankMap(getTeams());
  const thirdRows: GroupStanding[] = [];
  const thirdByGroup: Record<string, GroupStanding> = {};

  for (const standings of Object.values(standingsByGroup)) {
    const third = standings.find((s) => s.position === 3);
    if (third) {
      thirdRows.push(third);
      thirdByGroup[third.group] = third;
    }
  }

  const rankedThird = rankThirdPlaceTeams(thirdRows, fifa);
  const qualifiedThirdGroups = collectQualifiedThirdGroups(rankedThird);

  return { standingsByGroup, thirdByGroup, qualifiedThirdGroups };
}

export function buildConsensusKnockoutPath(
  store: PredictionStore,
  modalStandings: Record<string, GroupStanding[]>,
  confirmed: Map<string, PlayedMatchResult> = new Map(),
): { knockout: KnockoutPathMatch[]; championTeamId: string } {
  const ctx = contextFromModalStandings(modalStandings);
  const { championTeamId, path } = runKnockout(store, ctx, confirmed, null, true);
  return { knockout: path, championTeamId };
}
