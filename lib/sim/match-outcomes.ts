import type { Prediction } from "@/lib/types";

export type MatchOutcome = "home" | "draw" | "away";

export function parsePredictedScore(score: string | null): { homeGoals: number; awayGoals: number } {
  if (!score) return { homeGoals: 1, awayGoals: 0 };
  const parts = score.split("-").map((n) => Number(n.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n < 0)) {
    return { homeGoals: 1, awayGoals: 0 };
  }
  return { homeGoals: parts[0], awayGoals: parts[1] };
}

export function orientProbabilities(
  prediction: Prediction,
  homeTeamId: string,
): { homeWinPct: number; drawPct: number; awayWinPct: number } {
  const homeIsTeamA = prediction.teamA === homeTeamId;
  return {
    homeWinPct: homeIsTeamA ? prediction.homeWinPct : prediction.awayWinPct,
    drawPct: prediction.drawPct,
    awayWinPct: homeIsTeamA ? prediction.awayWinPct : prediction.homeWinPct,
  };
}

export function modalOutcome(
  prediction: Prediction,
  homeTeamId: string,
): MatchOutcome {
  const { homeWinPct, drawPct, awayWinPct } = orientProbabilities(prediction, homeTeamId);
  if (homeWinPct >= drawPct && homeWinPct >= awayWinPct) return "home";
  if (drawPct >= awayWinPct) return "draw";
  return "away";
}

export function sampleOutcome(rng: () => number, prediction: Prediction, homeTeamId: string): MatchOutcome {
  const { homeWinPct, drawPct } = orientProbabilities(prediction, homeTeamId);
  const roll = rng() * 100;
  if (roll < homeWinPct) return "home";
  if (roll < homeWinPct + drawPct) return "draw";
  return "away";
}

export function goalsFromOutcome(
  outcome: MatchOutcome,
  prediction: Prediction,
): { homeGoals: number; awayGoals: number } {
  const parsed = parsePredictedScore(prediction.predictedScore);
  if (outcome === "draw") {
    const g = Math.max(parsed.homeGoals, parsed.awayGoals, 0);
    return { homeGoals: g, awayGoals: g };
  }
  if (outcome === "home") {
    if (parsed.homeGoals > parsed.awayGoals) return parsed;
    const margin = Math.max(parsed.homeGoals, 2);
    return { homeGoals: margin, awayGoals: Math.max(margin - 1, 1) };
  }
  if (parsed.awayGoals > parsed.homeGoals) return parsed;
  const margin = Math.max(parsed.awayGoals, 2);
  return { homeGoals: Math.max(margin - 1, 1), awayGoals: margin };
}

export function computeAdvanceProbs(homeWinPct: number, drawPct: number, awayWinPct: number): {
  advanceHome: number;
  advanceAway: number;
} {
  const denom = homeWinPct + awayWinPct;
  if (denom <= 0) return { advanceHome: 50, advanceAway: 50 };
  const drawShareHome = (drawPct * homeWinPct) / denom;
  const drawShareAway = (drawPct * awayWinPct) / denom;
  return {
    advanceHome: homeWinPct + drawShareHome,
    advanceAway: awayWinPct + drawShareAway,
  };
}

export function modalKnockoutWinner(
  prediction: Prediction,
  homeTeamId: string,
  awayTeamId: string,
): string {
  const { homeWinPct, drawPct, awayWinPct } = orientProbabilities(prediction, homeTeamId);
  const { advanceHome, advanceAway } = computeAdvanceProbs(homeWinPct, drawPct, awayWinPct);
  return advanceHome >= advanceAway ? homeTeamId : awayTeamId;
}

export function sampleKnockoutWinner(
  rng: () => number,
  prediction: Prediction,
  homeTeamId: string,
  awayTeamId: string,
): string {
  const { homeWinPct, drawPct, awayWinPct } = orientProbabilities(prediction, homeTeamId);
  const { advanceHome } = computeAdvanceProbs(homeWinPct, drawPct, awayWinPct);
  return rng() * 100 < advanceHome ? homeTeamId : awayTeamId;
}
