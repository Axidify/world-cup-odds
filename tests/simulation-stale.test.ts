import { eq } from "drizzle-orm";
import { describe, it, expect, beforeEach } from "vitest";
import { savePrediction } from "@/lib/ai/predictions";
import { setActiveProvider } from "@/lib/ai/settings";
import { getFixtures } from "@/lib/data/load";
import { getDb } from "@/lib/db";
import { actualResults, appSettings, predictions, simulationCache } from "@/lib/db/schema";
import { countConfirmedSince } from "@/lib/results/confirmed-stats";
import { getSimulationStaleState, isSimulationStale } from "@/lib/sim/simulation-cache";
import { formatSimulationStaleMessage } from "@/lib/sim/stale-messages";

describe("simulation stale", () => {
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

  it("is not stale without a simulation run", () => {
    expect(isSimulationStale()).toBe(false);
  });

  it("marks stale when results confirm after last simulation", () => {
    const db = getDb();
    const runAt = "2026-06-10T12:00:00.000Z";
    db.insert(simulationCache)
      .values({
        provider: "vllm",
        model: "test",
        iterations: 100,
        championOdds: "{}",
        predictedPath: "{}",
        runAt,
      })
      .run();

    db.insert(actualResults)
      .values({
        matchId: "m1",
        homeScore: 2,
        awayScore: 1,
        et: 0,
        pens: 0,
        winnerTeamId: "usa",
        confirmed: 1,
        source: "test",
        syncedAt: "2026-06-11T12:00:00.000Z",
        confirmedAt: "2026-06-11T12:30:00.000Z",
        confirmedBy: "auto",
      })
      .run();

    const state = getSimulationStaleState();
    expect(state.stale).toBe(true);
    expect(state.resultsConfirmedSinceRun).toBe(1);
    expect(formatSimulationStaleMessage(state)).toContain("re-run simulation");
    expect(countConfirmedSince(runAt)).toBe(1);
  });

  it("marks stale when predictions are newer than simulation", () => {
    const db = getDb();
    db.insert(simulationCache)
      .values({
        provider: "vllm",
        model: "test",
        iterations: 100,
        championOdds: "{}",
        predictedPath: "{}",
        runAt: "2026-06-10T12:00:00.000Z",
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
        stale: 0,
        source: "llm" as const,
        generatedAt: "2026-06-11T12:00:00.000Z",
      })
      .run();

    const state = getSimulationStaleState();
    expect(state.stale).toBe(true);
    expect(state.predictionsNewerThanRun).toBe(true);
    expect(state.stalePredictionsExist).toBe(false);
    expect(formatSimulationStaleMessage(state)).toContain("re-run simulation");
    expect(formatSimulationStaleMessage(state)).not.toContain("re-analyze");
  });

  it("ignores stale rows for already-confirmed group fixtures", () => {
    const db = getDb();
    const fixture = getFixtures().find((m) => m.id === "grp-a-1");
    expect(fixture).toBeTruthy();

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

    savePrediction({
      homeTeamId: fixture!.homeTeamId,
      awayTeamId: fixture!.awayTeamId,
      stage: "group",
      provider: "vllm",
      model: "test",
      homeWinPct: 50,
      drawPct: 25,
      awayWinPct: 25,
      predictedScore: "1-0",
      keyFactors: [],
      analysis: "stale",
      source: "llm",
    });
    const row = db.select().from(predictions).get();
    expect(row).toBeTruthy();
    db.update(predictions).set({ stale: 1 }).where(eq(predictions.cacheKey, row!.cacheKey)).run();

    db.insert(actualResults)
      .values({
        matchId: fixture!.id,
        homeScore: 1,
        awayScore: 0,
        et: 0,
        pens: 0,
        winnerTeamId: fixture!.homeTeamId,
        confirmed: 1,
        source: "test",
        syncedAt: "2026-06-14T00:30:00.000Z",
        confirmedAt: "2026-06-14T00:30:00.000Z",
        confirmedBy: "auto",
      })
      .run();

    const state = getSimulationStaleState();
    expect(state.stalePredictionsExist).toBe(false);
    expect(formatSimulationStaleMessage(state)).toBeNull();
  });
});
