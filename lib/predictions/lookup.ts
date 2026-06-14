import { eq } from "drizzle-orm";
import type { LLMProvider, Prediction } from "@/lib/types";
import { buildCacheKey } from "@/lib/ai/cache-key";
import { isPredictionExpired } from "@/lib/ai/cache-ttl";
import { getModelForProvider } from "@/lib/ai/config";
import { KNOCKOUT_PRECACHE_STAGE } from "@/lib/ai/preanalyze";
import { getDb } from "@/lib/db";
import { predictions } from "@/lib/db/schema";
import { inferPredictionSource, isLlmPrediction } from "@/lib/predictions/source";
import {
  buildRankFallbackPrediction,
  isKnockoutFallbackStage,
} from "@/lib/sim/rank-fallback-prediction";

const KNOCKOUT_ROUND_STAGES = new Set(["r32", "r16", "qf", "sf", "final", "third_place"]);

export type PredictionTier = "fresh" | "stale" | "elo_fallback";

export type TieredPrediction = {
  prediction: Prediction;
  tier: PredictionTier;
};

function rowToPrediction(row: typeof predictions.$inferSelect): Prediction {
  const keyFactors = row.keyFactors ? (JSON.parse(row.keyFactors) as string[]) : [];
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
    keyFactors,
    analysis: row.analysis,
    isCalibrated: row.isCalibrated ?? 0,
    stale: row.stale ?? 0,
    source: inferPredictionSource({
      source: row.source,
      keyFactors,
      analysis: row.analysis,
    }),
    generatedAt: row.generatedAt,
  };
}

function stagesToTry(stage: string): string[] {
  const stages = [stage];
  if (KNOCKOUT_ROUND_STAGES.has(stage) && stage !== KNOCKOUT_PRECACHE_STAGE) {
    stages.push(KNOCKOUT_PRECACHE_STAGE);
  }
  return stages;
}

function classifyRow(row: Prediction): PredictionTier | null {
  const expired = isPredictionExpired(row.generatedAt);
  if (row.stale !== 1 && !expired) return "fresh";
  if (row.stale === 1 || (expired && row.source === "llm")) return "stale";
  return null;
}

function getRowByCacheKey(cacheKey: string): Prediction | null {
  const db = getDb();
  const row = db.select().from(predictions).where(eq(predictions.cacheKey, cacheKey)).get();
  return row ? rowToPrediction(row) : null;
}

/** Load all provider predictions once — used by simulation Monte Carlo hot paths. */
export function loadPredictionIndex(provider: LLMProvider): Map<string, Prediction> {
  const db = getDb();
  const rows = db.select().from(predictions).where(eq(predictions.provider, provider)).all();
  const index = new Map<string, Prediction>();
  for (const row of rows) {
    index.set(row.cacheKey, rowToPrediction(row));
  }
  return index;
}

function lookupPredictionTieredWithGetter(
  getRow: (cacheKey: string) => Prediction | null,
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  provider: LLMProvider,
  options: LookupPredictionOptions = {},
): TieredPrediction | null {
  const model = getModelForProvider(provider);
  const allowEloFallback = options.allowEloFallback ?? true;

  let staleHit: TieredPrediction | null = null;

  for (const s of stagesToTry(stage)) {
    const cacheKey = buildCacheKey(homeTeamId, awayTeamId, s, provider, model);
    const row = getRow(cacheKey);
    if (!row) continue;

    const tier = classifyRow(row);
    if (tier === "fresh") {
      return { prediction: row, tier: "fresh" };
    }
    if (tier === "stale" && !staleHit) {
      staleHit = { prediction: row, tier: "stale" };
    }
  }

  if (staleHit) return staleHit;

  if (allowEloFallback && isKnockoutFallbackStage(stage)) {
    return {
      prediction: buildRankFallbackPrediction(
        homeTeamId,
        awayTeamId,
        stage,
        provider,
        model,
        options.eloByTeam,
      ),
      tier: "elo_fallback",
    };
  }

  return null;
}

export function lookupPredictionTieredFromIndex(
  index: Map<string, Prediction>,
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  provider: LLMProvider,
  options: LookupPredictionOptions = {},
): TieredPrediction | null {
  return lookupPredictionTieredWithGetter(
    (cacheKey) => index.get(cacheKey) ?? null,
    homeTeamId,
    awayTeamId,
    stage,
    provider,
    options,
  );
}

export type LookupPredictionOptions = {
  eloByTeam?: Map<string, number>;
  allowEloFallback?: boolean;
};

/** Resolve a fixture prediction: fresh cache → stale/expired LLM → knockout Elo fallback. */
export function lookupPredictionTiered(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  provider: LLMProvider,
  options: LookupPredictionOptions = {},
): TieredPrediction | null {
  return lookupPredictionTieredWithGetter(
    getRowByCacheKey,
    homeTeamId,
    awayTeamId,
    stage,
    provider,
    options,
  );
}

/** Shared readiness check for bulk analyze cache hits and simulation `store.has()`. */
export function isFreshLlmCachedPair(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  provider: LLMProvider,
  index?: Map<string, Prediction>,
): boolean {
  const hit = index
    ? lookupPredictionTieredFromIndex(index, homeTeamId, awayTeamId, stage, provider, {
        allowEloFallback: false,
      })
    : lookupPredictionTiered(homeTeamId, awayTeamId, stage, provider, {
        allowEloFallback: false,
      });
  if (!hit) return false;
  return hit.tier === "fresh" && isLlmPrediction(hit.prediction);
}

export function shouldProtectFromEloSeed(existing: Prediction | null): boolean {
  if (!existing) return false;
  if (!isLlmPrediction(existing)) return false;
  return existing.stale === 1 || isPredictionExpired(existing.generatedAt);
}

/** LLM rows that should be re-analyzed: explicitly stale or TTL-expired. */
export function listStalePredictionRows(provider: LLMProvider): Prediction[] {
  const db = getDb();
  const model = getModelForProvider(provider);
  const rows = db
    .select()
    .from(predictions)
    .where(eq(predictions.provider, provider))
    .all();
  return rows
    .map(rowToPrediction)
    .filter((row) => {
      const markedStale =
        row.stale === 1 || (row.source === "llm" && isPredictionExpired(row.generatedAt));
      if (!markedStale) return false;
      // Ignore stale rows from retired models — analyze only targets the active model key.
      const expectedKey = buildCacheKey(row.teamA, row.teamB, row.stage, provider, model);
      return row.cacheKey === expectedKey;
    });
}
