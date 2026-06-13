import { sortTeamPair } from "@/lib/ai/cache-key";
import type { LLMProvider, MissingPairing, Prediction } from "@/lib/types";
import { getEloMap } from "@/lib/calibration/elo";
import { getFixtures } from "@/lib/data/load";
import { applyNewsImpactToStoredPrediction, isNewsImpactEnabled } from "@/lib/news/impact";
import { lookupPredictionTiered, isFreshLlmCachedPair } from "@/lib/predictions/lookup";
import { buildCacheKey } from "@/lib/ai/cache-key";
import { getModelForProvider } from "@/lib/ai/config";

export class MissingPredictionError extends Error {
  constructor(public missing: MissingPairing[]) {
    super(`Missing ${missing.length} prediction(s) for simulation`);
    this.name = "MissingPredictionError";
  }
}

export type PredictionStore = {
  get(homeTeamId: string, awayTeamId: string, stage: string, matchId?: string): Prediction;
  has(homeTeamId: string, awayTeamId: string, stage: string): boolean;
  listMissing(): MissingPairing[];
};

export type PredictionStoreOptions = {
  /** When false, simulation uses raw cached/Elo probabilities only. */
  applyNewsImpact?: boolean;
};

export function loadPredictionStore(
  provider: LLMProvider,
  options: PredictionStoreOptions = {},
): PredictionStore {
  const applyNews = options.applyNewsImpact ?? isNewsImpactEnabled();
  const fixtureDateById = new Map(getFixtures().map((m) => [m.id, m.date]));
  const eloByTeam = getEloMap();
  const newsAdjusted = new Map<string, Prediction>();
  const pendingMissing: MissingPairing[] = [];

  function withNewsImpact(pred: Prediction, matchId?: string): Prediction {
    if (!applyNews) return pred;
    const kickoff = matchId ? fixtureDateById.get(matchId) : undefined;
    const cacheKey = `${pred.cacheKey}|${kickoff ?? ""}`;
    const hit = newsAdjusted.get(cacheKey);
    if (hit) return hit;

    const out = applyNewsImpactToStoredPrediction(pred, kickoff);
    newsAdjusted.set(cacheKey, out);
    return out;
  }

  function lookup(home: string, away: string, stage: string, matchId?: string): Prediction | undefined {
    const hit = lookupPredictionTiered(home, away, stage, provider, { eloByTeam });
    if (!hit) return undefined;
    return withNewsImpact(hit.prediction, matchId);
  }

  return {
    get(homeTeamId, awayTeamId, stage, matchId) {
      const pred = lookup(homeTeamId, awayTeamId, stage, matchId);
      if (!pred) {
        const miss: MissingPairing = { homeTeamId, awayTeamId, stage, matchId };
        pendingMissing.push(miss);
        throw new MissingPredictionError([miss]);
      }
      return pred;
    },
    has(homeTeamId, awayTeamId, stage) {
      return isFreshLlmCachedPair(homeTeamId, awayTeamId, stage, provider);
    },
    listMissing() {
      const seen = new Set<string>();
      const out: MissingPairing[] = [];
      for (const m of pendingMissing) {
        const [a, b] = sortTeamPair(m.homeTeamId, m.awayTeamId);
        const id = `${a}|${b}|${m.stage}`;
        if (!seen.has(id)) {
          seen.add(id);
          out.push(m);
        }
      }
      return out;
    },
  };
}

/** Uniform predictions for every pairing — used in tests / dry runs without a full cache. */
export function createSyntheticPredictionStore(provider: LLMProvider): PredictionStore {
  const model = getModelForProvider(provider);
  return {
    get(homeTeamId, awayTeamId, stage) {
      const [teamA, teamB] = sortTeamPair(homeTeamId, awayTeamId);
      const homeIsTeamA = homeTeamId === teamA;
      return {
        cacheKey: buildCacheKey(homeTeamId, awayTeamId, stage, provider, model),
        teamA,
        teamB,
        stage,
        isNeutral: 1,
        provider,
        model,
        homeWinPct: homeIsTeamA ? 55 : 45,
        drawPct: 25,
        awayWinPct: homeIsTeamA ? 20 : 30,
        predictedScore: "1-0",
        keyFactors: [],
        analysis: null,
        isCalibrated: 0,
        stale: 0,
        source: "llm",
        generatedAt: new Date().toISOString(),
      };
    },
    has() {
      return true;
    },
    listMissing() {
      return [];
    },
  };
}

export function buildInMemoryPredictionStore(
  items: Array<{ home: string; away: string; stage: string; prediction: Prediction }>,
  provider: LLMProvider,
): PredictionStore {
  const model = getModelForProvider(provider);
  const byKey = new Map<string, Prediction>();
  for (const item of items) {
    const key = buildCacheKey(item.home, item.away, item.stage, provider, model);
    byKey.set(key, item.prediction);
  }
  const pendingMissing: MissingPairing[] = [];

  return {
    get(homeTeamId, awayTeamId, stage, matchId) {
      const key = buildCacheKey(homeTeamId, awayTeamId, stage, provider, model);
      const pred = byKey.get(key);
      if (!pred) {
        const miss = { homeTeamId, awayTeamId, stage, matchId };
        pendingMissing.push(miss);
        throw new MissingPredictionError([miss]);
      }
      return pred;
    },
    has(homeTeamId, awayTeamId, stage) {
      return byKey.has(buildCacheKey(homeTeamId, awayTeamId, stage, provider, model));
    },
    listMissing() {
      return [...pendingMissing];
    },
  };
}
