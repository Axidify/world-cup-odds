import type { KnockoutPathMatch } from "@/lib/types";
import { computeAdvanceProbs, orientProbabilities } from "@/lib/sim/match-outcomes";
import type { PredictionStore } from "@/lib/sim/prediction-store";

export type MatchAdvanceProbs = { home: number; away: number };

export function advanceProbsForTeams(
  store: PredictionStore,
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  matchId?: string,
): MatchAdvanceProbs | null {
  if (homeTeamId === "TBD" || awayTeamId === "TBD") return null;
  try {
    const pred = store.get(homeTeamId, awayTeamId, stage, matchId);
    const { homeWinPct, drawPct, awayWinPct } = orientProbabilities(pred, homeTeamId);
    const { advanceHome, advanceAway } = computeAdvanceProbs(homeWinPct, drawPct, awayWinPct);
    return { home: advanceHome, away: advanceAway };
  } catch {
    return null;
  }
}

export function buildAdvanceProbsForKnockoutPath(
  store: PredictionStore,
  path: KnockoutPathMatch[],
): Record<string, MatchAdvanceProbs> {
  const out: Record<string, MatchAdvanceProbs> = {};
  for (const entry of path) {
    const probs = advanceProbsForTeams(
      store,
      entry.homeTeamId,
      entry.awayTeamId,
      entry.stage,
      entry.matchId,
    );
    if (probs) out[entry.matchId] = probs;
  }
  return out;
}
