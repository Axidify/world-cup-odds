import { describe, it, expect } from "vitest";
import { createSyntheticPredictionStore } from "@/lib/sim/prediction-store";
import { clampSampleIndex, randomSampleIndex, runSamplePathAtIndex } from "@/lib/sim/sample-path";
import { runSampledTournament } from "@/lib/simulator";
import { createRng } from "@/lib/sim/rng";

describe("sample path", () => {
  it("matches runSampledTournament for the same seed index", () => {
    const store = createSyntheticPredictionStore("vllm");
    const seed = 4242;
    const index = 17;
    const a = runSamplePathAtIndex(store, index, seed);
    const b = runSampledTournament(store, createRng(seed + index));
    expect(a.championTeamId).toBe(b.championTeamId);
    expect(a.knockout).toEqual(b.knockout);
  });

  it("clamps index into iteration range", () => {
    expect(clampSampleIndex(-3, 100)).toBe(0);
    expect(clampSampleIndex(999, 100)).toBe(99);
    expect(clampSampleIndex(12.7, 100)).toBe(12);
  });

  it("picks random index within range", () => {
    const idx = randomSampleIndex(500, () => 0.5);
    expect(idx).toBe(250);
  });
});
