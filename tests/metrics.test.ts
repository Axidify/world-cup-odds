import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { buildCacheKey } from "@/lib/ai/cache-key";
import { savePrediction } from "@/lib/ai/predictions";
import { setActiveProvider } from "@/lib/ai/settings";
import {
  backfillPredictionAccuracyLogs,
  computeBrier,
  computeLogLoss,
  deriveActualOutcome,
  getAccuracySummary,
  isDirectionCorrect,
  logPredictionAccuracy,
  orientProbabilities,
  pickFavoriteOutcome,
  storedPredictedToProbs,
} from "@/lib/calibration/metrics";
import { getDb } from "@/lib/db";
import { actualResults, predictionLog } from "@/lib/db/schema";
import type { Match, Prediction } from "@/lib/types";

const groupMatch: Match = {
  id: "grp-a-1",
  stage: "group",
  group: "A",
  homeTeamId: "mex",
  awayTeamId: "rsa",
  date: "2026-06-11T19:00:00.000Z",
  venue: "Test",
};

const prediction: Prediction = {
  cacheKey: "test",
  teamA: "mex",
  teamB: "rsa",
  stage: "group",
  isNeutral: 1,
  provider: "vllm",
  model: "test",
  homeWinPct: 50,
  drawPct: 25,
  awayWinPct: 25,
  predictedScore: "2-1",
  keyFactors: [],
  analysis: null,
  isCalibrated: 0,
  stale: 0,
  source: "llm" as const,
  generatedAt: "2026-06-01T00:00:00.000Z",
};

describe("calibration metrics", () => {
  it("derives group outcomes", () => {
    expect(deriveActualOutcome(groupMatch, { homeScore: 2, awayScore: 1, winnerTeamId: null })).toBe("home");
    expect(deriveActualOutcome(groupMatch, { homeScore: 0, awayScore: 0, winnerTeamId: null })).toBe("draw");
    expect(deriveActualOutcome(groupMatch, { homeScore: 0, awayScore: 2, winnerTeamId: null })).toBe("away");
  });

  it("orients probabilities to home team", () => {
    const probs = orientProbabilities(prediction, "mex");
    expect(probs.home).toBeCloseTo(0.5);
    expect(probs.draw).toBeCloseTo(0.25);
    expect(probs.away).toBeCloseTo(0.25);
  });

  it("computes brier and log loss", () => {
    const probs = { home: 0.5, draw: 0.25, away: 0.25 };
    expect(computeBrier(probs, "home")).toBeCloseTo(0.375);
    expect(computeLogLoss(probs, "home")).toBeCloseTo(-Math.log(0.5));
  });

  it("checks direction accuracy", () => {
    const probs = { home: 0.6, draw: 0.2, away: 0.2 };
    expect(isDirectionCorrect(probs, "home")).toBe(true);
    expect(isDirectionCorrect(probs, "away")).toBe(false);
  });

  it("converts stored percentage predictions for metrics", () => {
    const probs = storedPredictedToProbs({ home: 60, draw: 20, away: 20 });
    expect(isDirectionCorrect(probs, "home")).toBe(true);
  });

  it("ignores draw when ranking knockout direction", () => {
    const probs = { home: 0.55, draw: 0.25, away: 0.2 };
    expect(isDirectionCorrect(probs, "home", { allowDraw: false })).toBe(true);
    expect(isDirectionCorrect(probs, "away", { allowDraw: false })).toBe(false);
  });

  it("derives knockout winner from winnerTeamId", () => {
    const ko: Match = { ...groupMatch, id: "r32-1", stage: "r32" };
    expect(
      deriveActualOutcome(ko, { homeScore: 1, awayScore: 1, winnerTeamId: "rsa" }),
    ).toBe("away");
  });

  it("returns null for knockout ties when winner is unknown", () => {
    const ko: Match = { ...groupMatch, id: "r32-2", stage: "r32" };
    expect(deriveActualOutcome(ko, { homeScore: 1, awayScore: 1, winnerTeamId: null })).toBeNull();
  });

  it("picks knockout favorite without draw", () => {
    expect(pickFavoriteOutcome({ home: 45, draw: 30, away: 25 }, "r32")).toBe("home");
    expect(pickFavoriteOutcome({ home: 25, draw: 40, away: 35 }, "group")).toBe("draw");
  });

  it("reports news impact comparison when baseline is stored", () => {
    const summary = getAccuracySummary();
    expect(summary).toHaveProperty("newsImpact");
    expect(summary).toHaveProperty("eloBaseline");
    expect(summary).toHaveProperty("sampleMaturity");
    if (summary.newsImpact) {
      expect(summary.newsImpact.countWithBaseline).toBeGreaterThan(0);
      expect(summary.newsImpact.avgBaselineBrier).not.toBeNull();
      expect(summary.newsImpact.avgNewsBrier).not.toBeNull();
    }
    if (summary.eloBaseline) {
      expect(summary.eloBaseline.count).toBeGreaterThan(0);
      expect(summary.eloBaseline.avgAiBrier).not.toBeNull();
      expect(summary.eloBaseline.avgEloBrier).not.toBeNull();
    }
  });
});

describe("backfillPredictionAccuracyLogs", () => {
  const matchId = "grp-a-1";

  beforeEach(() => {
    process.env.LLM_PROVIDER = "vllm";
    process.env.VLLM_BASE_URL = "http://127.0.0.1:8001/v1";
    process.env.VLLM_MODEL = "test-model";
    setActiveProvider("vllm");

    const db = getDb();
    db.delete(predictionLog).where(eq(predictionLog.matchId, matchId)).run();
    db.delete(actualResults).where(eq(actualResults.matchId, matchId)).run();
  });

  it("creates a log row when a confirmed result predates its prediction", () => {
    const db = getDb();
    db.insert(actualResults)
      .values({
        matchId,
        homeScore: 2,
        awayScore: 0,
        et: 0,
        pens: 0,
        winnerTeamId: "mex",
        confirmed: 1,
        source: "test",
        confirmedAt: "2026-06-11T22:00:00.000Z",
        confirmedBy: "auto",
      })
      .run();

    savePrediction({
      homeTeamId: "mex",
      awayTeamId: "rsa",
      stage: "group",
      provider: "vllm",
      model: "test-model",
      homeWinPct: 62,
      drawPct: 22,
      awayWinPct: 16,
      predictedScore: "2-0",
      keyFactors: ["form"],
      analysis: "Mexico at home",
      source: "llm",
    });

    expect(db.select().from(predictionLog).where(eq(predictionLog.matchId, matchId)).get()).toBeUndefined();

    const result = backfillPredictionAccuracyLogs();
    expect(result.attempted).toBeGreaterThanOrEqual(1);
    expect(result.added).toBeGreaterThanOrEqual(1);

    const row = db.select().from(predictionLog).where(eq(predictionLog.matchId, matchId)).get();
    expect(row?.actual).toBe("home");
    expect(row?.brier).not.toBeNull();
  });

  it("does not overwrite an existing log row", () => {
    const db = getDb();
    db.insert(actualResults)
      .values({
        matchId,
        homeScore: 2,
        awayScore: 0,
        et: 0,
        pens: 0,
        winnerTeamId: "mex",
        confirmed: 1,
        source: "test",
        confirmedAt: "2026-06-11T22:00:00.000Z",
        confirmedBy: "auto",
      })
      .run();

    db.insert(predictionLog)
      .values({
        id: `log-${matchId}`,
        matchId,
        cacheKey: buildCacheKey("mex", "rsa", "group", "vllm", "test-model"),
        predicted: JSON.stringify({ home: 40, draw: 30, away: 30 }),
        actual: "home",
        brier: 0.123,
        logLoss: 0.5,
        createdAt: "2026-06-11T22:00:00.000Z",
      })
      .run();

    savePrediction({
      homeTeamId: "mex",
      awayTeamId: "rsa",
      stage: "group",
      provider: "vllm",
      model: "test-model",
      homeWinPct: 90,
      drawPct: 5,
      awayWinPct: 5,
      predictedScore: "3-0",
      keyFactors: ["form"],
      analysis: "Much later analysis",
      source: "llm",
    });

    const result = backfillPredictionAccuracyLogs();
    expect(result.added).toBe(0);

    const row = db.select().from(predictionLog).where(eq(predictionLog.matchId, matchId)).get();
    expect(row?.brier).toBe(0.123);
  });

  it("runs automatically when loading the accuracy summary", () => {
    const db = getDb();
    db.insert(actualResults)
      .values({
        matchId,
        homeScore: 2,
        awayScore: 0,
        et: 0,
        pens: 0,
        winnerTeamId: "mex",
        confirmed: 1,
        source: "test",
        confirmedAt: "2026-06-11T22:00:00.000Z",
        confirmedBy: "auto",
      })
      .run();

    savePrediction({
      homeTeamId: "mex",
      awayTeamId: "rsa",
      stage: "group",
      provider: "vllm",
      model: "test-model",
      homeWinPct: 62,
      drawPct: 22,
      awayWinPct: 16,
      predictedScore: "2-0",
      keyFactors: ["form"],
      analysis: "Mexico at home",
      source: "llm",
    });

    const summary = getAccuracySummary();
    expect(summary.worstMisses.some((m) => m.matchId === matchId)).toBe(true);
  });

  it("does not overwrite an existing row when logPredictionAccuracy runs again", () => {
    const db = getDb();
    db.insert(actualResults)
      .values({
        matchId,
        homeScore: 2,
        awayScore: 0,
        et: 0,
        pens: 0,
        winnerTeamId: "mex",
        confirmed: 1,
        source: "test",
        confirmedAt: "2026-06-11T22:00:00.000Z",
        confirmedBy: "auto",
      })
      .run();

    savePrediction({
      homeTeamId: "mex",
      awayTeamId: "rsa",
      stage: "group",
      provider: "vllm",
      model: "test-model",
      homeWinPct: 62,
      drawPct: 22,
      awayWinPct: 16,
      predictedScore: "2-0",
      keyFactors: ["form"],
      analysis: "Original",
      source: "llm",
    });

    const first = logPredictionAccuracy(matchId);
    expect(first).not.toBeNull();
    const firstBrier = first!.brier;

    savePrediction({
      homeTeamId: "mex",
      awayTeamId: "rsa",
      stage: "group",
      provider: "vllm",
      model: "test-model",
      homeWinPct: 90,
      drawPct: 5,
      awayWinPct: 5,
      predictedScore: "3-0",
      keyFactors: ["form"],
      analysis: "Re-analyzed later",
      source: "llm",
    });

    const second = logPredictionAccuracy(matchId);
    expect(second?.brier).toBe(firstBrier);

    const row = db.select().from(predictionLog).where(eq(predictionLog.matchId, matchId)).get();
    expect(row?.brier).toBe(firstBrier);
  });
});
