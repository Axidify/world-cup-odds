import { describe, it, expect } from "vitest";
import type { Match } from "@/lib/types";
import { championBetWins, matchBetWins } from "@/lib/betting/outcome";
import { isKnockoutStage } from "@/lib/betting/locks";

const groupMatch: Match = {
  id: "grp-a-1",
  stage: "group",
  group: "A",
  homeTeamId: "mex",
  awayTeamId: "rsa",
  date: "2026-06-11T19:00:00.000Z",
  venue: "Test",
};

const knockoutMatch: Match = {
  id: "r16-1",
  stage: "r16",
  homeTeamId: "mex",
  awayTeamId: "bra",
  date: "2026-07-01T19:00:00.000Z",
  venue: "Test",
};

describe("bet outcomes", () => {
  it("settles group home/draw/away", () => {
    const result = { homeScore: 2, awayScore: 1, winnerTeamId: null };
    expect(matchBetWins(groupMatch, "home", result)).toBe(true);
    expect(matchBetWins(groupMatch, "away", result)).toBe(false);
    expect(matchBetWins(groupMatch, "draw", result)).toBe(false);
  });

  it("settles group draw", () => {
    const result = { homeScore: 1, awayScore: 1, winnerTeamId: null };
    expect(matchBetWins(groupMatch, "draw", result)).toBe(true);
    expect(matchBetWins(groupMatch, "home", result)).toBe(false);
  });

  it("settles knockout advance by winner", () => {
    expect(isKnockoutStage("r16")).toBe(true);
    const pens = { homeScore: 1, awayScore: 1, winnerTeamId: "bra" };
    expect(matchBetWins(knockoutMatch, "away", pens)).toBe(true);
    expect(matchBetWins(knockoutMatch, "home", pens)).toBe(false);
    expect(matchBetWins(knockoutMatch, "draw", pens)).toBe(false);
  });

  it("settles champion outright", () => {
    expect(championBetWins("mex", "mex")).toBe(true);
    expect(championBetWins("bra", "mex")).toBe(false);
  });
});
