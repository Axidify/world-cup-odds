import { getModelForProvider } from "@/lib/ai/config";
import { savePrediction } from "@/lib/ai/predictions";
import { getEloMap } from "@/lib/calibration/elo";
import {
  eloGroupMatchProbs,
  eloKnockoutMatchProbs,
  predictedScoreFromProbs,
} from "@/lib/calibration/elo-probabilities";
import { getFixtures } from "@/lib/data/load";
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

export function seedPairingFromElo(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  provider: LLMProvider,
  model: string,
  elo: Map<string, number> = getEloMap(),
): void {
  const probs = probsForStage(homeTeamId, awayTeamId, stage, elo);
  savePrediction({
    homeTeamId,
    awayTeamId,
    stage,
    provider,
    model,
    ...probs,
    predictedScore: predictedScoreFromProbs(probs),
    keyFactors: ["World Football Elo seed (eloratings.net)"],
    analysis:
      "Seeded from World Football Elo ratings — run LLM analyze to refine.",
  });
}

/** Seed all group fixtures (72 pairings). */
export function seedAllGroupFixturesFromElo(
  provider: LLMProvider,
  model = getModelForProvider(provider),
): number {
  const elo = getEloMap();
  let count = 0;
  for (const m of getFixtures()) {
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
    seedPairingFromElo(m.homeTeamId, m.awayTeamId, "group", provider, model, elo);
    count += 1;
  }
  return count;
}

/** Seed only gaps the simulation needs (group + knockout path). */
export function seedMissingPairingsFromElo(
  missing: MissingPairing[],
  provider: LLMProvider,
  model = getModelForProvider(provider),
): number {
  const elo = getEloMap();
  let count = 0;
  for (const g of missing) {
    seedPairingFromElo(g.homeTeamId, g.awayTeamId, g.stage, provider, model, elo);
    count += 1;
  }
  return count;
}
