import type { PredictionSource } from "@/lib/types";

export const TOURNAMENT_ELO_SEED_MARKER = "Tournament Elo seed";
const LEGACY_WFE_SEED_MARKER = "World Football Elo seed";
export const ELO_FALLBACK_MARKER = "Tournament Elo fallback";

export function inferPredictionSource(prediction: {
  source?: string | null;
  keyFactors: string[];
  analysis: string | null;
}): PredictionSource {
  if (
    prediction.source === "llm" ||
    prediction.source === "elo_seed" ||
    prediction.source === "elo_fallback"
  ) {
    return prediction.source;
  }

  const factors = prediction.keyFactors.join(" ");
  if (
    factors.includes(TOURNAMENT_ELO_SEED_MARKER) ||
    factors.includes(LEGACY_WFE_SEED_MARKER)
  ) {
    return "elo_seed";
  }
  if (prediction.analysis == null && factors.includes(ELO_FALLBACK_MARKER)) {
    return "elo_fallback";
  }
  return "llm";
}

export function isLlmPrediction(prediction: {
  source?: string | null;
  keyFactors: string[];
  analysis: string | null;
}): boolean {
  return inferPredictionSource(prediction) === "llm";
}
