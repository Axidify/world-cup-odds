import { describe, it, expect, vi, afterEach } from "vitest";
import * as resolved from "@/lib/data/resolved";
import { getNextUpcomingMatches } from "@/lib/match/next-upcoming";
import type { Match } from "@/lib/types";

describe("getNextUpcomingMatches", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns matches at the earliest future kickoff", () => {
    const now = Date.parse("2026-06-10T00:00:00.000Z");
    const next = getNextUpcomingMatches(now);
    expect(next.length).toBeGreaterThan(0);
    const kickoff = next[0].date;
    expect(next.every((m) => m.date === kickoff)).toBe(true);
    expect(new Date(kickoff).getTime()).toBeGreaterThan(now);
  });

  it("includes simultaneous kickoffs", () => {
    const now = Date.parse("2026-06-10T00:00:00.000Z");
    const next = getNextUpcomingMatches(now);
    const kickoff = next[0]?.date;
    const allAtKickoff = getNextUpcomingMatches(now).filter((m) => m.date === kickoff);
    expect(next.length).toBe(allAtKickoff.length);
  });

  it("returns empty when tournament is over", () => {
    const now = Date.parse("2030-01-01T00:00:00.000Z");
    expect(getNextUpcomingMatches(now)).toEqual([]);
  });

  it("includes resolved knockout fixtures once teams are known", () => {
    const r32: Match = {
      id: "r32-2",
      stage: "r32",
      homeTeamId: "ger",
      awayTeamId: "par",
      date: "2026-06-29T04:00:00.000Z",
      venue: "AT&T Stadium, Dallas",
      knockoutRound: 16,
    };
    vi.spyOn(resolved, "getResolvedMatches").mockReturnValue([r32]);

    const now = Date.parse("2026-06-29T03:00:00.000Z");
    expect(getNextUpcomingMatches(now)).toEqual([r32]);
  });
});
