import { eq } from "drizzle-orm";
import type { LLMProvider, MatchPredictionView, Prediction, PredictionSource } from "@/lib/types";
import { getDb } from "@/lib/db";
import { predictions } from "@/lib/db/schema";
import { inferPredictionSource } from "@/lib/predictions/source";
import { lookupPredictionTiered } from "@/lib/predictions/lookup";
import { buildCacheKey, sortTeamPair } from "./cache-key";
import { resolveActiveProvider } from "./settings";

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

export function getPredictionByCacheKey(cacheKey: string): Prediction | null {
  const db = getDb();
  const row = db.select().from(predictions).where(eq(predictions.cacheKey, cacheKey)).get();
  return row ? rowToPrediction(row) : null;
}

export function getPredictionForPair(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  provider = resolveActiveProvider() ?? undefined,
): Prediction | null {
  if (!provider) return null;
  const hit = lookupPredictionTiered(homeTeamId, awayTeamId, stage, provider, {
    allowEloFallback: false,
  });
  return hit?.prediction ?? null;
}

export function toMatchView(
  prediction: Prediction,
  homeTeamId: string,
  awayTeamId: string,
  fromCache: boolean,
  tier?: "fresh" | "stale" | "elo_fallback",
): MatchPredictionView {
  const homeIsTeamA = prediction.teamA === homeTeamId;
  return {
    cacheKey: prediction.cacheKey,
    homeWinPct: homeIsTeamA ? prediction.homeWinPct : prediction.awayWinPct,
    drawPct: prediction.drawPct,
    awayWinPct: homeIsTeamA ? prediction.awayWinPct : prediction.homeWinPct,
    predictedScore: prediction.predictedScore,
    keyFactors: prediction.keyFactors,
    analysis: prediction.analysis,
    provider: prediction.provider,
    model: prediction.model,
    generatedAt: prediction.generatedAt,
    stale: tier === "stale" || prediction.stale === 1,
    source: prediction.source,
    tier: tier ?? (prediction.stale === 1 ? "stale" : "fresh"),
    fromCache,
  };
}

export function savePrediction(
  input: {
    homeTeamId: string;
    awayTeamId: string;
    stage: string;
    provider: string;
    model: string;
    homeWinPct: number;
    drawPct: number;
    awayWinPct: number;
    predictedScore: string;
    keyFactors: string[];
    analysis: string;
    source?: PredictionSource;
  },
): Prediction {
  const [teamA, teamB] = sortTeamPair(input.homeTeamId, input.awayTeamId);
  const homeIsTeamA = input.homeTeamId === teamA;
  const cacheKey = buildCacheKey(
    input.homeTeamId,
    input.awayTeamId,
    input.stage,
    input.provider as LLMProvider,
    input.model,
  );
  const source = input.source ?? "llm";

  const record: Prediction = {
    cacheKey,
    teamA,
    teamB,
    stage: input.stage,
    isNeutral: 1,
    provider: input.provider,
    model: input.model,
    homeWinPct: homeIsTeamA ? input.homeWinPct : input.awayWinPct,
    drawPct: input.drawPct,
    awayWinPct: homeIsTeamA ? input.awayWinPct : input.homeWinPct,
    predictedScore: input.predictedScore,
    keyFactors: input.keyFactors,
    analysis: input.analysis,
    isCalibrated: 0,
    stale: 0,
    source,
    generatedAt: new Date().toISOString(),
  };

  const db = getDb();
  db.insert(predictions)
    .values({
      cacheKey: record.cacheKey,
      teamA: record.teamA,
      teamB: record.teamB,
      stage: record.stage,
      isNeutral: record.isNeutral,
      provider: record.provider,
      model: record.model,
      homeWinPct: record.homeWinPct,
      drawPct: record.drawPct,
      awayWinPct: record.awayWinPct,
      predictedScore: record.predictedScore,
      keyFactors: JSON.stringify(record.keyFactors),
      analysis: record.analysis,
      isCalibrated: record.isCalibrated,
      stale: record.stale,
      source: record.source,
      generatedAt: record.generatedAt,
    })
    .onConflictDoUpdate({
      target: predictions.cacheKey,
      set: {
        homeWinPct: record.homeWinPct,
        drawPct: record.drawPct,
        awayWinPct: record.awayWinPct,
        predictedScore: record.predictedScore,
        keyFactors: JSON.stringify(record.keyFactors),
        analysis: record.analysis,
        source: record.source,
        stale: 0,
        generatedAt: record.generatedAt,
      },
    })
    .run();

  return record;
}

export function countPredictions(options?: {
  provider?: LLMProvider | null;
  nonStale?: boolean;
}): number {
  const db = getDb();
  const provider = options?.provider ?? resolveActiveProvider();
  let rows = db.select().from(predictions).all();
  if (provider) rows = rows.filter((r) => r.provider === provider);
  if (options?.nonStale) rows = rows.filter((r) => r.stale !== 1);
  return rows.length;
}
