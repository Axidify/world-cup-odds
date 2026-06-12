import { describe, it, expect } from "vitest";
import {
  computeEloDelta,
  expectedHomeScore,
  getEloRating,
  recomputeEloFromConfirmedResults,
} from "@/lib/calibration/elo";
import { getWorldFootballEloSeed } from "@/lib/calibration/world-football-elo";

describe("elo ratings", () => {
  it("seeds from World Football Elo Ratings (eloratings.net)", () => {
    expect(getWorldFootballEloSeed("arg")).toBeGreaterThan(getWorldFootballEloSeed("gha")!);
    expect(getWorldFootballEloSeed("mex")).toBe(1881);
    expect(getWorldFootballEloSeed("esp")).toBe(2157);
  });

  it("computes expected home score from rating gap", () => {
    expect(expectedHomeScore(2000, 2000)).toBeCloseTo(0.5);
    expect(expectedHomeScore(2200, 2000)).toBeGreaterThan(0.5);
  });

  it("shifts ratings after an upset", () => {
    const { homeDelta, awayDelta } = computeEloDelta(2000, 2100, 1, 32);
    expect(homeDelta).toBeGreaterThan(0);
    expect(awayDelta).toBeLessThan(0);
    expect(homeDelta + awayDelta).toBeCloseTo(0);
  });

  it("recompute is idempotent", () => {
    recomputeEloFromConfirmedResults();
    const first = getEloRating("mex");
    recomputeEloFromConfirmedResults();
    expect(getEloRating("mex")).toBe(first);
  });

  it("undoing a prior adjustment before re-applying avoids double counting", () => {
    const baseHome = 2000;
    const baseAway = 2000;
    const { homeDelta, awayDelta } = computeEloDelta(baseHome, baseAway, 1, 32);
    const currentHome = baseHome + homeDelta;
    const currentAway = baseAway + awayDelta;

    const again = computeEloDelta(currentHome - homeDelta, currentAway - awayDelta, 1, 32);
    expect(currentHome - homeDelta + again.homeDelta).toBeCloseTo(currentHome, 5);
    expect(currentAway - awayDelta + again.awayDelta).toBeCloseTo(currentAway, 5);
  });
});
