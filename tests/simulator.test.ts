import { describe, it, expect } from "vitest";
import { computeAdvanceProbs } from "@/lib/sim/match-outcomes";
import { createSyntheticPredictionStore } from "@/lib/sim/prediction-store";
import {
  buildRepresentativePredictedPath,
  championOddsLeader,
  normalizeChampionOdds,
  runModalTournament,
  runMonteCarlo,
} from "@/lib/simulator";

describe("simulator", () => {
  it("splits draw mass for knockout advancement", () => {
    const { advanceHome, advanceAway } = computeAdvanceProbs(40, 20, 40);
    expect(advanceHome).toBeCloseTo(50, 5);
    expect(advanceAway).toBeCloseTo(50, 5);
    expect(advanceHome + advanceAway).toBeCloseTo(100, 5);
  });

  it("falls back to 50/50 when denom is zero", () => {
    const { advanceHome, advanceAway } = computeAdvanceProbs(0, 100, 0);
    expect(advanceHome).toBe(50);
    expect(advanceAway).toBe(50);
  });

  it("produces a modal champion with synthetic predictions", () => {
    const store = createSyntheticPredictionStore("vllm");
    const path = runModalTournament(store);
    expect(path.championTeamId).toBeTruthy();
    expect(path.knockout.length).toBe(32);
    expect(path.knockout.find((m) => m.stage === "final")).toBeTruthy();
  });

  it("Monte Carlo is reproducible with the same seed", () => {
    const store = createSyntheticPredictionStore("vllm");
    const a = runMonteCarlo(store, 80, 12345);
    const b = runMonteCarlo(store, 80, 12345);
    expect(a).toEqual(b);
  });

  it("representative bracket path champion matches Monte Carlo leader", () => {
    const store = createSyntheticPredictionStore("vllm");
    const iterations = 200;
    const seed = 4242;
    const odds = normalizeChampionOdds(runMonteCarlo(store, iterations, seed));
    const leader = championOddsLeader(odds);
    const path = buildRepresentativePredictedPath(store, odds, new Map(), iterations, seed);

    expect(path.championTeamId).toBe(leader);
    expect(path.knockout.length).toBe(32);
    expect(path.knockout.find((m) => m.stage === "final")?.winnerTeamId).toBe(leader);
  });

  it("representative path is reproducible with the same seed", () => {
    const store = createSyntheticPredictionStore("vllm");
    const iterations = 120;
    const seed = 999;
    const odds = normalizeChampionOdds(runMonteCarlo(store, iterations, seed));
    const a = buildRepresentativePredictedPath(store, odds, new Map(), iterations, seed);
    const b = buildRepresentativePredictedPath(store, odds, new Map(), iterations, seed);
    expect(a).toEqual(b);
  });
});
