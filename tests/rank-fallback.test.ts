import { describe, it, expect } from "vitest";
import { orientProbabilities } from "@/lib/sim/match-outcomes";
import { buildRankFallbackPrediction } from "@/lib/sim/rank-fallback-prediction";
import { buildInMemoryPredictionStore } from "@/lib/sim/prediction-store";
import { getFixtures } from "@/lib/data/load";
import { runMonteCarlo } from "@/lib/simulator";
import type { Prediction } from "@/lib/types";

function makePred(teamA: string, teamB: string, stage: string): Prediction {
  return {
    cacheKey: `${teamA}|${teamB}|${stage}`,
    teamA,
    teamB,
    stage,
    isNeutral: 1,
    provider: "vllm",
    model: "test",
    homeWinPct: 40,
    drawPct: 25,
    awayWinPct: 35,
    predictedScore: "1-1",
    keyFactors: [],
    analysis: null,
    isCalibrated: 0,
    stale: 0,
    generatedAt: new Date().toISOString(),
  };
}

describe("rank-fallback-prediction", () => {
  it("favors the higher-ranked team in a knockout fallback", () => {
    const pred = buildRankFallbackPrediction("ned", "sco", "r32", "vllm", "test");
    const { homeWinPct, awayWinPct } = orientProbabilities(pred, "ned");
    expect(homeWinPct).toBeGreaterThan(awayWinPct);
    expect(pred.keyFactors).toContain("Elo rank fallback");
  });

  it("lets Monte Carlo finish with only group-stage LLM predictions", () => {
    const fixtures = getFixtures();
    const groupStore = buildInMemoryPredictionStore(
      fixtures.map((m) => ({
        home: m.homeTeamId,
        away: m.awayTeamId,
        stage: "group",
        prediction: makePred(m.homeTeamId, m.awayTeamId, "group"),
      })),
      "vllm",
    );

    const store = {
      get(homeTeamId: string, awayTeamId: string, stage: string, matchId?: string) {
        if (groupStore.has(homeTeamId, awayTeamId, stage)) {
          return groupStore.get(homeTeamId, awayTeamId, stage, matchId);
        }
        return buildRankFallbackPrediction(homeTeamId, awayTeamId, stage, "vllm", "test");
      },
      has(homeTeamId: string, awayTeamId: string, stage: string) {
        return groupStore.has(homeTeamId, awayTeamId, stage) || stage !== "group";
      },
      listMissing() {
        return [];
      },
    };

    const odds = runMonteCarlo(store, 40, 12345);
    const total = Object.values(odds).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
  });
});
