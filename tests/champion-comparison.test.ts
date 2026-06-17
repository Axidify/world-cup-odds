import { describe, it, expect, beforeEach } from "vitest";
import { setActiveProvider } from "@/lib/ai/settings";
import { getDb } from "@/lib/db";
import { actualResults, appSettings, predictions, simulationCache } from "@/lib/db/schema";
import { countConfirmedAtOrBefore } from "@/lib/results/confirmed-stats";
import { getChampionUpdateContext } from "@/lib/sim/champion-update";
import {
  getComparisonBaselineSimulation,
  getLatestSimulation,
  needsSimulationRerun,
} from "@/lib/sim/simulation-cache";

function insertSim(runAt: string, odds: Record<string, number>) {
  const db = getDb();
  db.insert(simulationCache)
    .values({
      provider: "vllm",
      model: "test",
      iterations: 1000,
      championOdds: JSON.stringify(odds),
      predictedPath: "{}",
      runAt,
    })
    .run();
}

function insertConfirm(matchId: string, confirmedAt: string) {
  const db = getDb();
  db.insert(actualResults)
    .values({
      matchId,
      homeScore: 1,
      awayScore: 0,
      et: 0,
      pens: 0,
      winnerTeamId: "usa",
      confirmed: 1,
      source: "test",
      syncedAt: confirmedAt,
      confirmedAt,
      confirmedBy: "auto",
    })
    .run();
}

describe("champion comparison baseline", () => {
  beforeEach(() => {
    process.env.LLM_PROVIDER = "vllm";
    process.env.VLLM_BASE_URL = "http://127.0.0.1:8001/v1";
    process.env.VLLM_MODEL = "test";
    const db = getDb();
    db.delete(predictions).run();
    db.delete(simulationCache).run();
    db.delete(actualResults).run();
    db.delete(appSettings).run();
    setActiveProvider("vllm");
  });

  it("counts confirmed results at or before a timestamp", () => {
    insertConfirm("m1", "2026-06-16T08:00:00.000Z");
    insertConfirm("m2", "2026-06-17T01:13:00.000Z");

    expect(countConfirmedAtOrBefore("2026-06-16T12:00:00.000Z")).toBe(1);
    expect(countConfirmedAtOrBefore("2026-06-17T01:14:00.000Z")).toBe(2);
  });

  it("skips duplicate sims at the same confirm count and picks the prior confirm level", () => {
    insertConfirm("m1", "2026-06-16T08:00:00.000Z");
    insertConfirm("m2", "2026-06-16T08:30:00.000Z");
    insertConfirm("m3", "2026-06-17T01:13:00.000Z");

    insertSim("2026-06-16T08:14:00.000Z", { arg: 24, esp: 18 });
    insertSim("2026-06-17T01:13:30.000Z", { arg: 19, esp: 20 });
    insertSim("2026-06-17T01:14:12.000Z", { arg: 18.7, esp: 20 });

    const after = getLatestSimulation()!;
    const before = getComparisonBaselineSimulation(after);

    expect(before?.runAt).toBe("2026-06-16T08:14:00.000Z");
    expect(before?.championOdds.arg).toBe(24);
  });

  it("surfaces result-driven changes when startup duplicated the latest sim", () => {
    insertConfirm("m1", "2026-06-16T08:00:00.000Z");
    insertConfirm("m2", "2026-06-16T08:30:00.000Z");
    insertConfirm("m3", "2026-06-17T01:13:00.000Z");

    insertSim("2026-06-16T08:14:00.000Z", { arg: 24, esp: 18, fra: 14 });
    insertSim("2026-06-17T01:13:30.000Z", { arg: 19, esp: 20, fra: 16 });
    insertSim("2026-06-17T01:14:12.000Z", { arg: 18.7, esp: 20, fra: 16.7 });

    const ctx = getChampionUpdateContext();

    expect(ctx.status).toBe("updated");
    expect(ctx.before?.runAt).toBe("2026-06-16T08:14:00.000Z");
    expect(ctx.confirmedTriggers.length).toBeGreaterThan(0);
    expect(ctx.topMovers.length).toBeGreaterThan(0);
    expect(ctx.reasons.some((r) => r.includes("Triggered by"))).toBe(true);
    expect(ctx.reasons.some((r) => r.includes("pipeline startup"))).toBe(false);
  });

  it("falls back to the adjacent sim when confirm count is unchanged", () => {
    insertConfirm("m1", "2026-06-17T01:00:00.000Z");

    insertSim("2026-06-17T01:10:00.000Z", { arg: 20 });
    insertSim("2026-06-17T01:14:00.000Z", { arg: 22 });

    const after = getLatestSimulation()!;
    const before = getComparisonBaselineSimulation(after);

    expect(before?.runAt).toBe("2026-06-17T01:10:00.000Z");
  });

  it("does not require startup re-sim when only stale predictions exist", () => {
    const db = getDb();
    db.insert(simulationCache)
      .values({
        provider: "vllm",
        model: "test",
        iterations: 100,
        championOdds: "{}",
        predictedPath: "{}",
        runAt: "2026-06-14T01:00:00.000Z",
      })
      .run();

    db.insert(predictions)
      .values({
        cacheKey: "a|b|group|vllm|test",
        teamA: "a",
        teamB: "b",
        stage: "group",
        isNeutral: 1,
        provider: "vllm",
        model: "test",
        homeWinPct: 40,
        drawPct: 30,
        awayWinPct: 30,
        predictedScore: "1-1",
        keyFactors: "[]",
        analysis: null,
        isCalibrated: 0,
        stale: 1,
        source: "llm" as const,
        generatedAt: "2026-06-14T00:30:00.000Z",
      })
      .run();

    expect(needsSimulationRerun()).toBe(false);
  });

  it("requires startup re-sim when results confirm after the latest sim", () => {
    insertSim("2026-06-17T01:00:00.000Z", { arg: 20 });
    insertConfirm("m1", "2026-06-17T01:30:00.000Z");

    expect(needsSimulationRerun()).toBe(true);
  });
});
