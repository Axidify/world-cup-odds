import type { PlayedMatchResult, PredictedPath } from "@/lib/types";
import { createRng } from "@/lib/sim/rng";
import { runSampledTournament } from "@/lib/simulator";
import type { PredictionStore } from "@/lib/sim/prediction-store";

/** One full Monte Carlo draw at a fixed iteration index (reproducible). */
export function runSamplePathAtIndex(
  store: PredictionStore,
  index: number,
  seed: number,
  confirmed: Map<string, PlayedMatchResult> = new Map(),
): PredictedPath {
  const rng = createRng(seed + index);
  return runSampledTournament(store, rng, confirmed);
}

export function clampSampleIndex(index: number, iterations: number): number {
  if (!Number.isFinite(index) || iterations <= 0) return 0;
  return Math.max(0, Math.min(iterations - 1, Math.floor(index)));
}

export function randomSampleIndex(iterations: number, rng: () => number = Math.random): number {
  if (iterations <= 0) return 0;
  return Math.floor(rng() * iterations);
}
