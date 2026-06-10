import { describe, it, expect } from "vitest";
import { toMatchView } from "@/lib/ai/predictions";
import type { Prediction } from "@/lib/types";

function makePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    cacheKey: "bra|mex|group|1|vllm|test",
    teamA: "bra",
    teamB: "mex",
    stage: "group",
    isNeutral: 1,
    provider: "vllm",
    model: "test",
    homeWinPct: 55,
    drawPct: 25,
    awayWinPct: 20,
    predictedScore: "2-1",
    keyFactors: ["form"],
    analysis: "Brazil favored.",
    isCalibrated: 0,
    stale: 0,
    generatedAt: "2026-06-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("toMatchView", () => {
  it("maps probabilities when home team is teamA", () => {
    const view = toMatchView(makePrediction(), "bra", "mex", true);
    expect(view.homeWinPct).toBe(55);
    expect(view.drawPct).toBe(25);
    expect(view.awayWinPct).toBe(20);
    expect(view.fromCache).toBe(true);
  });

  it("swaps win probabilities when home team is teamB", () => {
    const view = toMatchView(makePrediction(), "mex", "bra", false);
    expect(view.homeWinPct).toBe(20);
    expect(view.drawPct).toBe(25);
    expect(view.awayWinPct).toBe(55);
    expect(view.fromCache).toBe(false);
  });
});
