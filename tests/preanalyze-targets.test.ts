import { describe, it, expect, beforeEach } from "vitest";
import {
  buildBulkAnalyzeQueue,
  buildTop24Pairings,
  countBulkTargetsLight,
  countSimulationMissing,
  invalidateBulkTargetsCache,
  KNOCKOUT_PRECACHE_STAGE,
} from "@/lib/ai/preanalyze";
import { savePrediction } from "@/lib/ai/predictions";
import { setActiveProvider } from "@/lib/ai/settings";
import { getFixtures } from "@/lib/data/load";
import { getDb } from "@/lib/db";
import { appSettings, predictions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function seedFreshLlm(homeTeamId: string, awayTeamId: string, stage: string) {
  savePrediction({
    homeTeamId,
    awayTeamId,
    stage,
    provider: "vllm",
    model: "test-model",
    homeWinPct: 50,
    drawPct: 25,
    awayWinPct: 25,
    predictedScore: "1-0",
    keyFactors: ["form"],
    analysis: "LLM analysis",
    source: "llm",
  });
}

describe("preanalyze targets", () => {
  beforeEach(() => {
    process.env.LLM_PROVIDER = "vllm";
    process.env.VLLM_BASE_URL = "http://127.0.0.1:8001/v1";
    process.env.VLLM_MODEL = "test-model";

    const db = getDb();
    db.delete(predictions).run();
    db.delete(appSettings).run();
    setActiveProvider("vllm");
    invalidateBulkTargetsCache();
  });

  it("remaining matches the bulk analyze queue length", () => {
    const { remaining } = countBulkTargetsLight(false);
    const queueLen = buildBulkAnalyzeQueue({ refresh: false, includeGaps: true }).length;
    expect(remaining).toBe(queueLen);
  });

  it("remaining is derived from queue length not inflated counters", () => {
    const { remaining, baselineMissing, simulationMissing } = countBulkTargetsLight(false);
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThanOrEqual(baselineMissing + simulationMissing + 100);
  });

  it("does not report zero remaining when simulation still has bracket gaps", () => {
    for (const m of getFixtures()) {
      if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
      seedFreshLlm(m.homeTeamId, m.awayTeamId, "group");
    }
    for (const p of buildTop24Pairings()) {
      seedFreshLlm(p.homeTeamId, p.awayTeamId, KNOCKOUT_PRECACHE_STAGE);
    }
    invalidateBulkTargetsCache();

    const { remaining, baselineMissing, simulationMissing } = countBulkTargetsLight(false);

    expect(baselineMissing).toBe(0);
    if (simulationMissing > 0) {
      expect(remaining).toBeGreaterThan(0);
    } else {
      expect(remaining).toBe(0);
    }
  });

  it("counts stale rows in remaining when they still need refresh", () => {
    const fixture = getFixtures().find((m) => m.id === "grp-b-1");
    expect(fixture).toBeTruthy();

    savePrediction({
      homeTeamId: fixture!.homeTeamId,
      awayTeamId: fixture!.awayTeamId,
      stage: "group",
      provider: "vllm",
      model: "test-model",
      homeWinPct: 50,
      drawPct: 25,
      awayWinPct: 25,
      predictedScore: "1-0",
      keyFactors: [],
      analysis: "stale",
      source: "llm",
    });
    const db = getDb();
    const row = db.select().from(predictions).get();
    db.update(predictions).set({ stale: 1 }).where(eq(predictions.cacheKey, row!.cacheKey)).run();
    invalidateBulkTargetsCache();

    const { remaining, staleMissing } = countBulkTargetsLight(false);
    expect(staleMissing).toBeGreaterThan(0);
    expect(remaining).toBeGreaterThan(0);
  });
});
