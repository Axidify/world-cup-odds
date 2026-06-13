import { getModelForProvider } from "@/lib/ai/config";
import { getPredictionByCacheKey, savePrediction } from "@/lib/ai/predictions";
import { buildCacheKey } from "@/lib/ai/cache-key";
import { getEloMap } from "@/lib/calibration/elo";
import {
  eloGroupMatchProbs,
  eloKnockoutMatchProbs,
  predictedScoreFromProbs,
} from "@/lib/calibration/elo-probabilities";
import { getFixtures } from "@/lib/data/load";
import { shouldProtectFromEloSeed } from "@/lib/predictions/lookup";
import { TOURNAMENT_ELO_SEED_MARKER } from "@/lib/predictions/source";
import { isKnockoutFallbackStage } from "@/lib/sim/rank-fallback-prediction";
import type { LLMProvider, MissingPairing } from "@/lib/types";

function probsForStage(
  homeId: string,
  awayId: string,
  stage: string,
  elo: Map<string, number>,
) {
  const eloHome = elo.get(homeId) ?? 1500;
  const eloAway = elo.get(awayId) ?? 1500;
  return isKnockoutFallbackStage(stage)
    ? eloKnockoutMatchProbs(eloHome, eloAway)
    : eloGroupMatchProbs(eloHome, eloAway);
}

export type SeedPairingOptions = {
  allowOverwrite?: boolean;
};

export function seedPairingFromElo(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  provider: LLMProvider,
  model: string,
  elo: Map<string, number> = getEloMap(),
  options: SeedPairingOptions = {},
): boolean {
  const allowOverwrite = options.allowOverwrite ?? false;
  const cacheKey = buildCacheKey(homeTeamId, awayTeamId, stage, provider, model);
  const existing = getPredictionByCacheKey(cacheKey);
  if (!allowOverwrite && shouldProtectFromEloSeed(existing)) {
    return false;
  }

  const probs = probsForStage(homeTeamId, awayTeamId, stage, elo);
  const eloHome = elo.get(homeTeamId) ?? 1500;
  const eloAway = elo.get(awayTeamId) ?? 1500;
  savePrediction({
    homeTeamId,
    awayTeamId,
    stage,
    provider,
    model,
    ...probs,
    predictedScore: predictedScoreFromProbs(probs, eloHome, eloAway),
    keyFactors: [TOURNAMENT_ELO_SEED_MARKER],
    analysis: "Seeded from tournament Elo — run LLM analyze to refine.",
    source: "elo_seed",
  });
  return true;
}

/** Seed all group fixtures (72 pairings). */
export function seedAllGroupFixturesFromElo(
  provider: LLMProvider,
  model = getModelForProvider(provider),
  options: SeedPairingOptions = { allowOverwrite: false },
): number {
  const elo = getEloMap();
  let count = 0;
  for (const m of getFixtures()) {
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
    if (seedPairingFromElo(m.homeTeamId, m.awayTeamId, "group", provider, model, elo, options)) {
      count += 1;
    }
  }
  return count;
}

/** Seed only gaps the simulation needs (group + knockout path). */
export function seedMissingPairingsFromElo(
  missing: MissingPairing[],
  provider: LLMProvider,
  model = getModelForProvider(provider),
  options: SeedPairingOptions = { allowOverwrite: false },
): number {
  const elo = getEloMap();
  let count = 0;
  for (const g of missing) {
    if (
      seedPairingFromElo(g.homeTeamId, g.awayTeamId, g.stage, provider, model, elo, options)
    ) {
      count += 1;
    }
  }
  return count;
}
