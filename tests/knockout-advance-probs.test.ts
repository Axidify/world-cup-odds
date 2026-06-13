import { describe, it, expect } from "vitest";
import { createSyntheticPredictionStore } from "@/lib/sim/prediction-store";
import { advanceProbsForTeams, buildAdvanceProbsForKnockoutPath } from "@/lib/bracket/knockout-advance-probs";
import { computeAdvanceProbs } from "@/lib/sim/match-outcomes";

describe("knockout advance probs", () => {
  const store = createSyntheticPredictionStore("vllm");

  it("returns advance probabilities for a known pairing", () => {
    const probs = advanceProbsForTeams(store, "bra", "arg", "r32", "r32-1");
    expect(probs).not.toBeNull();
    expect(probs!.home + probs!.away).toBeCloseTo(100, 5);
  });

  it("builds a map keyed by match id from a knockout path", () => {
    const path = [
      {
        matchId: "r32-1",
        stage: "r32" as const,
        homeTeamId: "bra",
        awayTeamId: "arg",
        winnerTeamId: "bra",
      },
    ];
    const map = buildAdvanceProbsForKnockoutPath(store, path);
    expect(map["r32-1"]).toBeDefined();
    expect(map["r32-1"].home + map["r32-1"].away).toBeCloseTo(100, 5);
  });

  it("sums advance probabilities to 100", () => {
    const { advanceHome, advanceAway } = computeAdvanceProbs(50, 25, 25);
    expect(advanceHome + advanceAway).toBeCloseTo(100, 5);
    expect(advanceHome).toBeGreaterThan(advanceAway);
  });
});
