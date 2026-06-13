import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { buildCacheKey } from "@/lib/ai/cache-key";
import { getPredictionForPair, savePrediction } from "@/lib/ai/predictions";
import { setActiveProvider } from "@/lib/ai/settings";
import { buildBulkAnalyzeQueue } from "@/lib/ai/preanalyze";
import { seedPairingFromElo } from "@/lib/calibration/seed-elo-predictions";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getDb } from "@/lib/db";
import { appSettings, predictions } from "@/lib/db/schema";
import { markTeamsStale } from "@/lib/results/on-confirm";
import type { LLMProvider } from "@/lib/types";

describe("prediction cache", () => {
  const originalTtl = process.env.PREDICTION_CACHE_TTL_DAYS;

  beforeEach(() => {
    process.env.LLM_PROVIDER = "vllm";
    process.env.VLLM_BASE_URL = "http://127.0.0.1:8001/v1";
    process.env.VLLM_MODEL = "test-model";
    delete process.env.PREDICTION_CACHE_TTL_DAYS;

    const db = getDb();
    db.delete(predictions).run();
    db.delete(appSettings).run();
    setActiveProvider("vllm");
  });

  afterEach(() => {
    if (originalTtl === undefined) delete process.env.PREDICTION_CACHE_TTL_DAYS;
    else process.env.PREDICTION_CACHE_TTL_DAYS = originalTtl;
  });

  function seedPrediction(
    homeTeamId: string,
    awayTeamId: string,
    stage: string,
    overrides: Partial<{
      provider: LLMProvider;
      model: string;
      stale: number;
      generatedAt: string;
    }> = {},
  ) {
    const provider = overrides.provider ?? "vllm";
    const model = overrides.model ?? "test-model";
    savePrediction({
      homeTeamId,
      awayTeamId,
      stage,
      provider,
      model,
      homeWinPct: 50,
      drawPct: 25,
      awayWinPct: 25,
      predictedScore: "1-1",
      keyFactors: ["test"],
      analysis: "Test prediction.",
    });
    const cacheKey = buildCacheKey(homeTeamId, awayTeamId, stage, provider, model);
    if (overrides.stale != null || overrides.generatedAt) {
      getDb()
        .update(predictions)
        .set({
          ...(overrides.stale != null ? { stale: overrides.stale } : {}),
          ...(overrides.generatedAt ? { generatedAt: overrides.generatedAt } : {}),
        })
        .where(eq(predictions.cacheKey, cacheKey))
        .run();
    }
    return cacheKey;
  }

  it("resolves the same cache row regardless of home/away argument order", () => {
    seedPrediction("bra", "mex", "group");
    const a = getPredictionForPair("bra", "mex", "group", "vllm");
    const b = getPredictionForPair("mex", "bra", "group", "vllm");
    expect(a?.cacheKey).toBe(b?.cacheKey);
    expect(a?.teamA).toBe("bra");
    expect(a?.teamB).toBe("mex");
  });

  it("falls back from knockout round stage to knockout precache", () => {
    seedPrediction("bra", "mex", "knockout");
    const hit = getPredictionForPair("mex", "bra", "r32", "vllm");
    expect(hit).not.toBeNull();
    expect(hit?.stage).toBe("knockout");
  });

  it("returns expired LLM predictions for display lookup", () => {
    seedPrediction("bra", "mex", "group", {
      generatedAt: "2020-01-01T00:00:00.000Z",
    });
    const row = getPredictionForPair("bra", "mex", "group", "vllm");
    expect(row).not.toBeNull();
    expect(row?.source).toBe("llm");
  });

  it("still returns stale predictions for display lookup", () => {
    seedPrediction("bra", "mex", "group", { stale: 1 });
    const row = getPredictionForPair("bra", "mex", "group", "vllm");
    expect(row).not.toBeNull();
    expect(row?.stale).toBe(1);
  });

  it("isolates cache by provider", () => {
    seedPrediction("bra", "mex", "group", { provider: "vllm", model: "test-model" });
    expect(getPredictionForPair("bra", "mex", "group", "openai")).toBeNull();
  });

  it("marks predictions stale for both teams", () => {
    seedPrediction("bra", "mex", "group");
    seedPrediction("bra", "arg", "group");
    seedPrediction("fra", "mex", "group");

    markTeamsStale("bra", "mex");

    expect(getPredictionForPair("bra", "mex", "group", "vllm")?.stale).toBe(1);
    expect(getPredictionForPair("bra", "arg", "group", "vllm")?.stale).toBe(1);
    expect(getPredictionForPair("fra", "mex", "group", "vllm")?.stale).toBe(1);
  });

  it("skips cached fixtures in bulk queue when provider is configured", () => {
    const fx = buildBulkAnalyzeQueue({ refresh: false, includeGaps: false });
    const before = fx.length;
    expect(before).toBeGreaterThan(0);

    const first = fx[0];
    if (first.kind === "match") {
      const match = getResolvedMatch(first.matchId);
      if (match) seedPrediction(match.homeTeamId, match.awayTeamId, "group");
    }

    const after = buildBulkAnalyzeQueue({ refresh: false, includeGaps: false });
    expect(after.length).toBe(before - 1);
  });

  it("queues elo-seeded fixtures for bulk analyze", () => {
    const fx = buildBulkAnalyzeQueue({ refresh: false, includeGaps: false });
    const first = fx[0];
    expect(first?.kind).toBe("match");
    if (first?.kind !== "match") return;

    const match = getResolvedMatch(first.matchId);
    expect(match).toBeTruthy();
    seedPairingFromElo(match!.homeTeamId, match!.awayTeamId, "group", "vllm", "test-model");

    const stillQueued = buildBulkAnalyzeQueue({ refresh: false, includeGaps: false });
    expect(stillQueued.some((q) => q.kind === "match" && q.matchId === first.matchId)).toBe(
      true,
    );
  });
});
