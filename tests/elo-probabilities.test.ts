import { describe, expect, it } from "vitest";
import {
  eloGroupMatchProbs,
  groupDrawPct,
} from "@/lib/calibration/elo-probabilities";

describe("elo probabilities", () => {
  it("draw % falls as Elo gap widens", () => {
    expect(groupDrawPct(2000, 2000)).toBeGreaterThan(groupDrawPct(2000, 1700));
  });

  it("group probs sum to 100", () => {
    const probs = eloGroupMatchProbs(1881, 1511);
    expect(probs.homeWinPct + probs.drawPct + probs.awayWinPct).toBeCloseTo(100, 1);
    expect(probs.homeWinPct).toBeGreaterThan(probs.awayWinPct);
  });
});
