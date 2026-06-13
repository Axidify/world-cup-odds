import { describe, it, expect, beforeEach } from "vitest";
import {
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

  it("remaining is max(baselineMissing, simulationMissing)", () => {
    const { remaining, baselineMissing } = countBulkTargetsLight(false);
    const simMissing = countSimulationMissing();
    expect(remaining).toBe(Math.max(baselineMissing, simMissing));
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

    const { remaining, baselineMissing } = countBulkTargetsLight(false);
    const simMissing = countSimulationMissing();

    expect(baselineMissing).toBe(0);
    if (simMissing > 0) {
      expect(remaining).toBe(simMissing);
      expect(remaining).toBeGreaterThan(0);
    } else {
      expect(remaining).toBe(0);
    }
  });
});
