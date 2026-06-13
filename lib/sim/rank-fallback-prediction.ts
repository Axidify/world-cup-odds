import { buildCacheKey, sortTeamPair } from "@/lib/ai/cache-key";
import { KNOCKOUT_PRECACHE_STAGE } from "@/lib/ai/preanalyze";
import { getEloMap } from "@/lib/calibration/elo";
import {
  eloGroupMatchProbs,
  eloKnockoutMatchProbs,
  predictedScoreFromProbs,
} from "@/lib/calibration/elo-probabilities";
import type { LLMProvider, Prediction } from "@/lib/types";
import { ELO_FALLBACK_MARKER } from "@/lib/predictions/source";

const KNOCKOUT_ROUND_STAGES = new Set(["r32", "r16", "qf", "sf", "final", "third_place"]);

export function isKnockoutFallbackStage(stage: string): boolean {
  return KNOCKOUT_ROUND_STAGES.has(stage) || stage === KNOCKOUT_PRECACHE_STAGE;
}

/** Elo-derived prediction when no LLM cache exists — used for rare Monte Carlo bracket paths. */
export function buildRankFallbackPrediction(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  provider: LLMProvider,
  model: string,
  eloByTeam: Map<string, number> = getEloMap(),
): Prediction {
  const [teamA, teamB] = sortTeamPair(homeTeamId, awayTeamId);
  const elo = eloByTeam;
  const eloHome = elo.get(homeTeamId) ?? 1500;
  const eloAway = elo.get(awayTeamId) ?? 1500;
  const probs = isKnockoutFallbackStage(stage)
    ? eloKnockoutMatchProbs(eloHome, eloAway)
    : eloGroupMatchProbs(eloHome, eloAway);
  const teamAWin = teamA === homeTeamId ? probs.homeWinPct : probs.awayWinPct;
  const teamBWin = teamA === homeTeamId ? probs.awayWinPct : probs.homeWinPct;

  return {
    cacheKey: buildCacheKey(homeTeamId, awayTeamId, stage, provider, model),
    teamA,
    teamB,
    stage,
    isNeutral: 1,
    provider,
    model,
    homeWinPct: teamAWin,
    drawPct: probs.drawPct,
    awayWinPct: teamBWin,
    predictedScore: predictedScoreFromProbs(probs, eloHome, eloAway),
    keyFactors: [ELO_FALLBACK_MARKER],
    analysis: null,
    isCalibrated: 0,
    stale: 0,
    source: "elo_fallback",
    generatedAt: new Date().toISOString(),
  };
}
