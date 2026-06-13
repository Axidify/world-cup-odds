import { describe, it, expect } from "vitest";
import {
  favoriteFixtureOutcome,
  teamAbbrev,
} from "@/lib/match/fixture-probs-display";

describe("fixture prob display helpers", () => {
  it("picks home when highest", () => {
    expect(favoriteFixtureOutcome({ home: 52, draw: 28, away: 20 })).toEqual({
      side: "home",
      pct: 52,
    });
  });

  it("picks draw when highest", () => {
    expect(favoriteFixtureOutcome({ home: 30, draw: 40, away: 30 })).toEqual({
      side: "draw",
      pct: 40,
    });
  });

  it("abbreviates team names", () => {
    expect(teamAbbrev("Mexico")).toBe("MEX");
    expect(teamAbbrev("South Korea")).toBe("SOU");
  });
});
