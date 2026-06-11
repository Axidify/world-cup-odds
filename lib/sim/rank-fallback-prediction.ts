import { buildCacheKey, sortTeamPair } from "@/lib/ai/cache-key";
import { KNOCKOUT_PRECACHE_STAGE } from "@/lib/ai/preanalyze";
import { expectedHomeScore, getEloMap } from "@/lib/calibration/elo";
import type { LLMProvider, Prediction } from "@/lib/types";

const KNOCKOUT_ROUND_STAGES = new Set(["r32", "r16", "qf", "sf", "final", "third_place"]);
const KNOCKOUT_DRAW_PCT = 10;

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
  const pHome = expectedHomeScore(eloHome, eloAway);

  const drawPct = KNOCKOUT_DRAW_PCT;
  const remain = 100 - drawPct;
  const homeWin = pHome * remain;
  const awayWin = (1 - pHome) * remain;
  const teamAWin = teamA === homeTeamId ? homeWin : awayWin;
  const teamBWin = teamA === homeTeamId ? awayWin : homeWin;

  return {
    cacheKey: buildCacheKey(homeTeamId, awayTeamId, stage, provider, model),
    teamA,
    teamB,
    stage,
    isNeutral: 1,
    provider,
    model,
    homeWinPct: teamAWin,
    drawPct,
    awayWinPct: teamBWin,
    predictedScore: teamAWin >= teamBWin ? "2-1" : "1-2",
    keyFactors: ["Elo rank fallback"],
    analysis: null,
    isCalibrated: 0,
    stale: 0,
    generatedAt: new Date().toISOString(),
  };
}
