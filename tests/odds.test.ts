import { describe, it, expect, afterEach } from "vitest";
import {
  formatDecimalOdds,
  getPoolVigPct,
  potentialPayout,
  probabilityToDecimalOdds,
} from "@/lib/betting/odds";

describe("betting odds", () => {
  const originalVig = process.env.POOL_VIG_PCT;

  afterEach(() => {
    if (originalVig === undefined) delete process.env.POOL_VIG_PCT;
    else process.env.POOL_VIG_PCT = originalVig;
  });

  it("converts probability to fair decimal odds", () => {
    expect(probabilityToDecimalOdds(45)).toBeCloseTo(2.22, 2);
    expect(probabilityToDecimalOdds(28)).toBeCloseTo(3.57, 2);
    expect(probabilityToDecimalOdds(18)).toBeCloseTo(5.56, 2);
  });

  it("applies office vig when configured", () => {
    process.env.POOL_VIG_PCT = "0.05";
    expect(getPoolVigPct()).toBe(0.05);
    expect(probabilityToDecimalOdds(50)).toBeCloseTo(1.9, 2);
  });

  it("computes potential payout", () => {
    expect(potentialPayout(10, 2.22)).toBe(22.2);
  });

  it("rejects zero probability", () => {
    expect(() => probabilityToDecimalOdds(0)).toThrow();
  });

  it("formats decimal odds", () => {
    expect(formatDecimalOdds(2.2)).toBe("2.20");
  });
});
