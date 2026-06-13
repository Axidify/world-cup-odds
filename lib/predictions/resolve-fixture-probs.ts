import type { LLMProvider, MatchPredictionView, Prediction } from "@/lib/types";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { orientProbabilities } from "@/lib/sim/match-outcomes";
import {
  applyNewsImpactToStoredPrediction,
  getPairNewsImpact,
  isNewsImpactEnabled,
} from "@/lib/news/impact";
import { lookupPredictionTiered, type PredictionTier } from "@/lib/predictions/lookup";
import { isLlmPrediction } from "@/lib/predictions/source";

export type FixtureProbabilityResolution = {
  prediction: Prediction;
  tier: PredictionTier;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  newsAdjusted: boolean;
};

export function resolveFixtureProbabilities(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  options: {
    provider?: LLMProvider | null;
    kickoffIso?: string;
    applyNews?: boolean;
  } = {},
): FixtureProbabilityResolution | null {
  const provider = options.provider ?? resolveActiveProvider();
  if (!provider) return null;

  const hit = lookupPredictionTiered(homeTeamId, awayTeamId, stage, provider);
  if (!hit) return null;

  const applyNews = options.applyNews ?? isNewsImpactEnabled();
  const withNews = applyNews
    ? applyNewsImpactToStoredPrediction(hit.prediction, options.kickoffIso)
    : hit.prediction;
  const oriented = orientProbabilities(withNews, homeTeamId);

  return {
    prediction: hit.prediction,
    tier: hit.tier,
    homeWinPct: oriented.homeWinPct,
    drawPct: oriented.drawPct,
    awayWinPct: oriented.awayWinPct,
    newsAdjusted: applyNews && withNews !== hit.prediction,
  };
}

/** Build a match-page view from a unified fixture resolution (single news pass). */
export function toMatchPredictionView(
  resolved: FixtureProbabilityResolution,
  homeTeamId: string,
  awayTeamId: string,
  kickoffIso?: string,
): MatchPredictionView {
  const pred = resolved.prediction;
  const view: MatchPredictionView = {
    cacheKey: pred.cacheKey,
    homeWinPct: resolved.homeWinPct,
    drawPct: resolved.drawPct,
    awayWinPct: resolved.awayWinPct,
    predictedScore: pred.predictedScore,
    keyFactors: pred.keyFactors,
    analysis: pred.analysis,
    provider: pred.provider,
    model: pred.model,
    generatedAt: pred.generatedAt,
    stale: resolved.tier === "stale",
    source: pred.source,
    tier: resolved.tier,
    fromCache: true,
    newsAdjusted: resolved.newsAdjusted,
  };

  if (resolved.newsAdjusted) {
    const { home, away } = kickoffIso
      ? getPairNewsImpact(homeTeamId, awayTeamId, kickoffIso)
      : getPairNewsImpact(homeTeamId, awayTeamId);
    view.newsImpact = { homeEloDelta: home.eloDelta, awayEloDelta: away.eloDelta };
  }

  return view;
}

/** Aligns with preanalyze `isCached`: only skip an LLM call for a fresh LLM row. */
export function shouldUseCachedPredictionForAnalyze(
  resolved: FixtureProbabilityResolution | null,
  refresh: boolean,
): boolean {
  if (refresh || !resolved) return false;
  return resolved.tier === "fresh" && isLlmPrediction(resolved.prediction);
}
