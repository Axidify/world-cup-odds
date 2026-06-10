import { afterEach, describe, it, expect, vi } from "vitest";
import { getMatchesNeedingResults } from "@/lib/jobs/poll-results";

describe("getMatchesNeedingResults", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("excludes future kickoffs", () => {
    const matches = getMatchesNeedingResults();
    const future = matches.filter((m) => new Date(m.date).getTime() > Date.now());
    expect(future).toHaveLength(0);
  });

  it("returns only matches with known teams", () => {
    const matches = getMatchesNeedingResults();
    expect(matches.every((m) => m.homeTeamId !== "TBD" && m.awayTeamId !== "TBD")).toBe(true);
  });

  it("backfill is more inclusive than normal polling within the buffer window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T20:30:00.000Z"));

    const normal = getMatchesNeedingResults();
    const backfill = getMatchesNeedingResults({ backfill: true });

    expect(backfill.length).toBeGreaterThanOrEqual(normal.length);
    for (const m of normal) {
      expect(backfill.some((b) => b.id === m.id)).toBe(true);
    }

    const backfillOnly = backfill.filter((m) => !normal.some((n) => n.id === m.id));
    for (const m of backfillOnly) {
      const kickoff = new Date(m.date).getTime();
      expect(kickoff).toBeLessThanOrEqual(Date.now());
      expect(kickoff + 2 * 60 * 60 * 1000).toBeGreaterThan(Date.now());
    }
  });
});
