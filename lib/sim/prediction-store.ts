import { eq } from "drizzle-orm";
import type { LLMProvider, MissingPairing, Prediction } from "@/lib/types";
import { getDb } from "@/lib/db";
import { predictions } from "@/lib/db/schema";
import { buildCacheKey, sortTeamPair } from "@/lib/ai/cache-key";
import { isPredictionExpired } from "@/lib/ai/cache-ttl";
import { getModelForProvider } from "@/lib/ai/config";
import { KNOCKOUT_PRECACHE_STAGE } from "@/lib/ai/preanalyze";
import { getEloMap } from "@/lib/calibration/elo";
import {
  adjustProbabilities,
  getPairNewsImpact,
  isNewsImpactEnabled,
} from "@/lib/news/impact";
import {
  buildRankFallbackPrediction,
  isKnockoutFallbackStage,
} from "@/lib/sim/rank-fallback-prediction";

const KNOCKOUT_ROUND_STAGES = new Set(["r32", "r16", "qf", "sf", "final", "third_place"]);

export class MissingPredictionError extends Error {
  constructor(public missing: MissingPairing[]) {
    super(`Missing ${missing.length} prediction(s) for simulation`);
    this.name = "MissingPredictionError";
  }
}

function rowToPrediction(row: typeof predictions.$inferSelect): Prediction {
  return {
    cacheKey: row.cacheKey,
    teamA: row.teamA,
    teamB: row.teamB,
    stage: row.stage,
    isNeutral: row.isNeutral ?? 1,
    provider: row.provider,
    model: row.model,
    homeWinPct: row.homeWinPct,
    drawPct: row.drawPct,
    awayWinPct: row.awayWinPct,
    predictedScore: row.predictedScore,
    keyFactors: row.keyFactors ? (JSON.parse(row.keyFactors) as string[]) : [],
    analysis: row.analysis,
    isCalibrated: row.isCalibrated ?? 0,
    stale: row.stale ?? 0,
    generatedAt: row.generatedAt,
  };
}

export type PredictionStore = {
  get(homeTeamId: string, awayTeamId: string, stage: string, matchId?: string): Prediction;
  has(homeTeamId: string, awayTeamId: string, stage: string): boolean;
  listMissing(): MissingPairing[];
};

export function loadPredictionStore(provider: LLMProvider): PredictionStore {
  const model = getModelForProvider(provider);
  const db = getDb();
  const rows = db
    .select()
    .from(predictions)
    .where(eq(predictions.provider, provider))
    .all();

  const byKey = new Map<string, Prediction>();
  for (const row of rows) {
    if (row.stale === 1) continue;
    const pred = rowToPrediction(row);
    if (isPredictionExpired(pred.generatedAt)) continue;
    byKey.set(pred.cacheKey, pred);
  }

  const pendingMissing: MissingPairing[] = [];
  const eloByTeam = getEloMap();
  const newsAdjusted = new Map<string, Prediction>();

  function lookupKey(home: string, away: string, stage: string) {
    return buildCacheKey(home, away, stage, provider, model);
  }

  // Predictions are stored teamA-oriented, so apply news deltas the same way.
  function withNewsImpact(pred: Prediction): Prediction {
    if (!isNewsImpactEnabled()) return pred;
    const hit = newsAdjusted.get(pred.cacheKey);
    if (hit) return hit;

    const { home, away } = getPairNewsImpact(pred.teamA, pred.teamB);
    const result = adjustProbabilities(
      pred.homeWinPct,
      pred.drawPct,
      pred.awayWinPct,
      home.eloDelta,
      away.eloDelta,
    );
    const out = result.adjusted
      ? {
          ...pred,
          homeWinPct: result.homeWinPct,
          drawPct: result.drawPct,
          awayWinPct: result.awayWinPct,
        }
      : pred;
    newsAdjusted.set(pred.cacheKey, out);
    return out;
  }

  function lookup(home: string, away: string, stage: string): Prediction | undefined {
    const stages = [stage];
    if (KNOCKOUT_ROUND_STAGES.has(stage)) stages.push(KNOCKOUT_PRECACHE_STAGE);
    for (const s of stages) {
      const pred = byKey.get(lookupKey(home, away, s));
      if (pred) return withNewsImpact(pred);
    }
    if (isKnockoutFallbackStage(stage)) {
      return withNewsImpact(
        buildRankFallbackPrediction(home, away, stage, provider, model, eloByTeam),
      );
    }
    return undefined;
  }

  return {
    get(homeTeamId, awayTeamId, stage, matchId) {
      const pred = lookup(homeTeamId, awayTeamId, stage);
      if (!pred) {
        const miss: MissingPairing = { homeTeamId, awayTeamId, stage, matchId };
        pendingMissing.push(miss);
        throw new MissingPredictionError([miss]);
      }
      return pred;
    },
    has(homeTeamId, awayTeamId, stage) {
      return lookup(homeTeamId, awayTeamId, stage) !== undefined;
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
