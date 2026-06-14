import { beforeEach, describe, expect, it } from "vitest";
import type { Match } from "@/lib/types";
import { getDb } from "@/lib/db";
import { actualResults } from "@/lib/db/schema";
import {
  applyFinishedResultsToTargets,
  hasStablePendingScore,
  type ParsedFinishedResult,
} from "@/lib/results/apply-finished";
import { getResult } from "@/lib/results/store";

const qatSui: Match = {
  id: "grp-b-2",
  stage: "group",
  group: "B",
  homeTeamId: "qat",
  awayTeamId: "sui",
  date: "2026-06-13T19:00:00.000Z",
  venue: "San Francisco",
};

function parsed(overrides: Partial<ParsedFinishedResult> = {}): ParsedFinishedResult {
  return {
    homeScore: 1,
    awayScore: 1,
    et: false,
    pens: false,
    winnerTeamId: null,
    source: "test",
    listDetailAgree: true,
    ...overrides,
  };
}

describe("applyFinishedResultsToTargets", () => {
  beforeEach(() => {
    getDb().delete(actualResults).run();
  });

  it("holds first sighting pending without confirming", () => {
    const map = new Map([["grp-b-2", parsed()]]);
    const summary = applyFinishedResultsToTargets([qatSui], map);

    expect(summary).toEqual({ confirmed: 0, synced: 1, failed: 0 });
    expect(getResult("grp-b-2")?.confirmed).toBe(false);
    expect(getResult("grp-b-2")?.homeScore).toBe(1);
  });

  it("confirms when the same score appears on a second poll", () => {
    const db = getDb();
    db.insert(actualResults)
      .values({
        matchId: "grp-b-2",
        homeScore: 1,
        awayScore: 1,
        et: 0,
        pens: 0,
        winnerTeamId: null,
        confirmed: 0,
        source: "test",
        syncedAt: "2026-06-13T21:00:00.000Z",
        confirmedAt: null,
        confirmedBy: null,
      })
      .run();

    expect(hasStablePendingScore("grp-b-2", { homeScore: 1, awayScore: 1 })).toBe(true);

    const map = new Map([["grp-b-2", parsed()]]);
    const summary = applyFinishedResultsToTargets([qatSui], map);

    expect(summary.confirmed).toBe(1);
    expect(getResult("grp-b-2")?.confirmed).toBe(true);
  });

  it("resets stability when the score changes between polls", () => {
    const db = getDb();
    db.insert(actualResults)
      .values({
        matchId: "grp-b-2",
        homeScore: 0,
        awayScore: 0,
        et: 0,
        pens: 0,
        winnerTeamId: null,
        confirmed: 0,
        source: "test",
        syncedAt: "2026-06-13T21:00:00.000Z",
        confirmedAt: null,
        confirmedBy: null,
      })
      .run();

    const map = new Map([["grp-b-2", parsed({ homeScore: 1, awayScore: 1 })]]);
    const summary = applyFinishedResultsToTargets([qatSui], map);

    expect(summary.confirmed).toBe(0);
    expect(getResult("grp-b-2")?.homeScore).toBe(1);
    expect(getResult("grp-b-2")?.confirmed).toBe(false);
  });

  it("holds pending when list and detail scores disagree", () => {
    const db = getDb();
    db.insert(actualResults)
      .values({
        matchId: "grp-b-2",
        homeScore: 1,
        awayScore: 1,
        et: 0,
        pens: 0,
        winnerTeamId: null,
        confirmed: 0,
        source: "test",
        syncedAt: "2026-06-13T21:00:00.000Z",
        confirmedAt: null,
        confirmedBy: null,
      })
      .run();

    const map = new Map([["grp-b-2", parsed({ listDetailAgree: false })]]);
    const summary = applyFinishedResultsToTargets([qatSui], map);

    expect(summary.confirmed).toBe(0);
    expect(getResult("grp-b-2")?.confirmed).toBe(false);
  });

  it("confirms on first poll when last live score corroborates the FT line", () => {
    const map = new Map([["grp-b-2", parsed({ corroboratedByLive: true })]]);
    const summary = applyFinishedResultsToTargets([qatSui], map);

    expect(summary.confirmed).toBe(1);
    expect(getResult("grp-b-2")?.confirmed).toBe(true);
  });
});
