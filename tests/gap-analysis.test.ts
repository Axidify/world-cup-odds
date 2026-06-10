import { describe, it, expect } from "vitest";
import { collectMissingPairings } from "@/lib/sim/gap-analysis";
import { runModalTournament } from "@/lib/simulator";
import {
  buildInMemoryPredictionStore,
  createSyntheticPredictionStore,
} from "@/lib/sim/prediction-store";
import type { Prediction } from "@/lib/types";
import { getFixtures } from "@/lib/data/load";

function makePred(teamA: string, teamB: string, stage: string): Prediction {
  return {
    cacheKey: `${teamA}|${teamB}|${stage}`,
    teamA,
    teamB,
    stage,
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
    generatedAt: new Date().toISOString(),
  };
}

describe("gap-analysis", () => {
  it("reports all missing group predictions, not just the first", () => {
    const fixtures = getFixtures();
    const first = fixtures[0];
    const store = buildInMemoryPredictionStore(
      [
        {
          home: first.homeTeamId,
          away: first.awayTeamId,
          stage: "group",
          prediction: makePred(first.homeTeamId, first.awayTeamId, "group"),
        },
      ],
      "vllm",
    );

    const missing = collectMissingPairings(store, "vllm");
    const groupMissing = missing.filter((m) => m.stage === "group");
    expect(groupMissing.length).toBe(fixtures.length - 1);
  });

  it("skips confirmed group matches when enumerating gaps", () => {
    const fixtures = getFixtures();
    const first = fixtures[0];
    const empty = buildInMemoryPredictionStore([], "vllm");
    const confirmed = new Map([
      [
        first.id,
        {
          matchId: first.id,
          homeTeamId: first.homeTeamId,
          awayTeamId: first.awayTeamId,
          homeGoals: 2,
          awayGoals: 1,
        },
      ],
    ]);
    const missing = collectMissingPairings(empty, "vllm", confirmed);
    expect(missing.some((m) => m.matchId === first.id)).toBe(false);
  });

  it("does not require predictions for confirmed knockout winners on modal path", () => {
    const store = createSyntheticPredictionStore("vllm");
    const path = collectMissingPairings(store, "vllm");
    expect(path).toHaveLength(0);

    const modal = runModalTournament(store, new Map());
    const r32 = modal.knockout.find((m) => m.stage === "r32");
    expect(r32).toBeTruthy();

    const empty = buildInMemoryPredictionStore([], "vllm");
    const confirmed = new Map([
      [
        r32!.matchId,
        {
          matchId: r32!.matchId,
          homeTeamId: r32!.homeTeamId,
          awayTeamId: r32!.awayTeamId,
          homeGoals: 1,
          awayGoals: 0,
          winnerTeamId: r32!.homeTeamId,
        },
      ],
    ]);
    const missing = collectMissingPairings(empty, "vllm", confirmed);
    expect(missing.some((m) => m.matchId === r32!.matchId)).toBe(false);
  });
});
