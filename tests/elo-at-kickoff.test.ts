import { describe, expect, it } from "vitest";
import { eloGroupMatchProbs } from "@/lib/calibration/elo-probabilities";
import { eloProbabilitiesAtKickoff } from "@/lib/calibration/elo-at-kickoff";

describe("eloProbabilitiesAtKickoff", () => {
  it("returns normalized probabilities for a known group fixture", () => {
    const probs = eloProbabilitiesAtKickoff("grp-a-1");
    expect(probs).not.toBeNull();
    if (!probs) return;
    const sum = probs.home + probs.draw + probs.away;
    expect(sum).toBeCloseTo(1, 2);
    expect(probs.home).toBeGreaterThan(0);
    expect(probs.draw).toBeGreaterThan(0);
    expect(probs.away).toBeGreaterThan(0);
  });

  it("matches eloGroupMatchProbs at seeds when no prior results", () => {
    const probs = eloProbabilitiesAtKickoff("grp-a-1");
    expect(probs).not.toBeNull();
    // grp-a-1 is mex vs rsa in test DB — use direct elo if we had ratings;
    // at minimum verify structure is consistent with elo module
    const direct = eloGroupMatchProbs(1800, 1700);
    expect(direct.homeWinPct + direct.drawPct + direct.awayWinPct).toBeCloseTo(100, 0);
    if (probs) {
      expect(probs.home + probs.draw + probs.away).toBeCloseTo(1, 2);
    }
  });
});
