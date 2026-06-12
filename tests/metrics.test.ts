import { describe, it, expect } from "vitest";
import {
  computeBrier,
  computeLogLoss,
  deriveActualOutcome,
  getAccuracySummary,
  isDirectionCorrect,
  orientProbabilities,
  pickFavoriteOutcome,
  storedPredictedToProbs,
} from "@/lib/calibration/metrics";
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
    if (summary.newsImpact) {
      expect(summary.newsImpact.countWithBaseline).toBeGreaterThan(0);
      expect(summary.newsImpact.avgBaselineBrier).not.toBeNull();
      expect(summary.newsImpact.avgNewsBrier).not.toBeNull();
    }
  });
});
