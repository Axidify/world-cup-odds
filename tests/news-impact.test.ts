import { describe, it, expect } from "vitest";
import type { Prediction } from "@/lib/types";
import {
  adjustProbabilities,
  applyNewsImpactToStoredPrediction,
  computeImpactFromEvents,
  fixtureProbabilitiesWithNews,
  scaleNewsDeltaForFixture,
} from "@/lib/news/impact";

describe("news impact scoring", () => {
  it("returns zero impact with no events", () => {
    const impact = computeImpactFromEvents("bra", []);
    expect(impact.eloDelta).toBe(0);
    expect(impact.reasons).toEqual([]);
  });

  it("penalizes injuries scaled by severity and key-player status", () => {
    const minor = computeImpactFromEvents("bra", [
      { type: "injury", player: "A", severity: "minor", keyPlayer: false },
    ]);
    const majorKey = computeImpactFromEvents("bra", [
      { type: "injury", player: "B", severity: "major", keyPlayer: true },
    ]);
    expect(minor.eloDelta).toBe(-8);
    expect(majorKey.eloDelta).toBe(-35);
  });

  it("credits returns and discounts card risk", () => {
    const impact = computeImpactFromEvents("arg", [
      { type: "return", player: "C", severity: "major", keyPlayer: true },
      { type: "card", player: "D", severity: "moderate", keyPlayer: false },
    ]);
    // +30 (return) - 5 (card risk) = 25
    expect(impact.eloDelta).toBe(25);
  });

  it("caps total team impact at configured max (default ±35)", () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      type: "injury",
      player: `P${i}`,
      severity: "major" as const,
      keyPlayer: true,
    }));
    expect(computeImpactFromEvents("ger", events).eloDelta).toBe(-35);
  });

  it("treats unknown severity as moderate", () => {
    const impact = computeImpactFromEvents("fra", [
      { type: "suspension", player: "E", severity: null, keyPlayer: false },
    ]);
    expect(impact.eloDelta).toBe(-20);
  });
});

describe("probability adjustment", () => {
  it("is a no-op when deltas cancel out", () => {
    const result = adjustProbabilities(50, 25, 25, -20, -20);
    expect(result.adjusted).toBe(false);
    expect(result.homeWinPct).toBe(50);
  });

  it("shifts probability toward the unaffected side", () => {
    const result = adjustProbabilities(50, 25, 25, -60, 0);
    expect(result.adjusted).toBe(true);
    expect(result.homeWinPct).toBeLessThan(50);
    expect(result.awayWinPct).toBeGreaterThan(25);
    expect(result.homeWinPct + result.drawPct + result.awayWinPct).toBeCloseTo(100, 5);
  });

  it("keeps draw share constant and stays within bounds", () => {
    const result = adjustProbabilities(90, 8, 2, -80, 80);
    expect(result.drawPct).toBe(8);
    expect(result.homeWinPct).toBeGreaterThanOrEqual(1);
    expect(result.awayWinPct).toBeGreaterThanOrEqual(1);
    expect(result.homeWinPct + result.drawPct + result.awayWinPct).toBeCloseTo(100, 5);
  });

  it("is symmetric for mirrored deltas", () => {
    const a = adjustProbabilities(40, 30, 30, -40, 0);
    const b = adjustProbabilities(30, 30, 40, 0, -40);
    expect(a.homeWinPct).toBeCloseTo(b.awayWinPct, 1);
    expect(a.awayWinPct).toBeCloseTo(b.homeWinPct, 1);
  });
});

describe("scaleNewsDeltaForFixture", () => {
  const kickoff = "2026-06-15T18:00:00.000Z";

  it("uses full delta at kickoff when reference time is kickoff", () => {
    const atKickoff = new Date(kickoff).getTime();
    expect(scaleNewsDeltaForFixture(-30, kickoff, atKickoff)).toBe(-30);
  });

  it("scales delta down when reference time is well before kickoff", () => {
    const sevenDaysBefore = new Date(kickoff).getTime() - 7 * 86_400_000;
    const scaled = scaleNewsDeltaForFixture(-30, kickoff, sevenDaysBefore);
    expect(scaled).toBeLessThan(0);
    expect(Math.abs(scaled)).toBeLessThan(30);
  });
});

describe("fixtureProbabilitiesWithNews", () => {
  const base: Prediction = {
    cacheKey: "test",
    teamA: "bra",
    teamB: "arg",
    stage: "group",
    isNeutral: 1,
    provider: "vllm",
    model: "test",
    homeWinPct: 50,
    drawPct: 25,
    awayWinPct: 25,
    predictedScore: "1-1",
    keyFactors: [],
    analysis: null,
    isCalibrated: 0,
    stale: 0,
    source: "llm" as const,
    generatedAt: "2026-06-01T00:00:00.000Z",
  };

  it("orients teamA storage to fixture home before adjusting", () => {
    const probs = fixtureProbabilitiesWithNews(base, "bra", "arg");
    expect(probs.home).toBeCloseTo(0.5);
    expect(probs.draw).toBeCloseTo(0.25);
    expect(probs.away).toBeCloseTo(0.25);
  });

  it("swaps home/away when fixture home is teamB", () => {
    const probs = fixtureProbabilitiesWithNews(base, "arg", "bra");
    expect(probs.home).toBeCloseTo(0.25);
    expect(probs.away).toBeCloseTo(0.5);
  });
});

describe("applyNewsImpactToStoredPrediction", () => {
  it("is a no-op when news impact is disabled", () => {
    const pred: Prediction = {
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
      predictedScore: "1-0",
      keyFactors: [],
      analysis: null,
      isCalibrated: 0,
      stale: 0,
      source: "llm" as const,
      generatedAt: "2026-06-01T00:00:00.000Z",
    };
    const prev = process.env.NEWS_IMPACT_ENABLED;
    process.env.NEWS_IMPACT_ENABLED = "false";
    try {
      expect(applyNewsImpactToStoredPrediction(pred)).toBe(pred);
    } finally {
      process.env.NEWS_IMPACT_ENABLED = prev;
    }
  });
});
