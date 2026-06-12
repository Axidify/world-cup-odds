import { getFixtures } from "@/lib/data/load";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { buildGroupResults } from "@/lib/simulator";
import { loadPredictionStore } from "@/lib/sim/prediction-store";
import type { PlayedMatchResult, PredictedPath } from "@/lib/types";

export function groupResultsToMap(
  results: PlayedMatchResult[],
): Map<string, PlayedMatchResult> {
  return new Map(results.map((r) => [r.matchId, r]));
}

/** Modal (most-likely) group scores — same logic as projected standings. */
export function getModalProjectedGroupResults(
  confirmed: Map<string, PlayedMatchResult>,
): PlayedMatchResult[] {
  const provider = resolveActiveProvider();
  if (!provider) return [];

  const store = loadPredictionStore(provider);
  return buildGroupResults(getFixtures(), store, confirmed, null);
}

export function getProjectedGroupScores(
  confirmed: Map<string, PlayedMatchResult>,
  predictedPath?: PredictedPath | null,
): Map<string, PlayedMatchResult> {
  if (predictedPath?.groupResults?.length) {
    return groupResultsToMap(predictedPath.groupResults);
  }
  if (predictedPath) {
    return groupResultsToMap(getModalProjectedGroupResults(confirmed));
  }
  return new Map();
}
