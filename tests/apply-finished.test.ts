import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Match } from "@/lib/types";
import { getDb } from "@/lib/db";
import { actualResults, liveScores } from "@/lib/db/schema";
import { upsertLiveScore } from "@/lib/results/live-scores/store";
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
    ...overrides,
  };
}

describe("applyFinishedResultsToTargets", () => {
  beforeEach(() => {
    const db = getDb();
    db.delete(actualResults).run();
    db.delete(liveScores).run();
  });

  it("confirms on first poll when list and detail agree from football-data", () => {
    const map = new Map([["grp-b-2", parsed({ listDetailAgree: true, apiFinished: true })]]);
    const summary = applyFinishedResultsToTargets([qatSui], map);

    expect(summary.confirmed).toBe(1);
    expect(getResult("grp-b-2")?.confirmed).toBe(true);
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

  it("ignores FT feed while the match is still in the live window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T17:00:00.000Z"));

    const espCpv: Match = {
      id: "grp-h-1",
      stage: "group",
      group: "H",
      homeTeamId: "esp",
      awayTeamId: "cpv",
      date: "2026-06-15T16:00:00.000Z",
      venue: "Atlanta",
    };

    const map = new Map([["grp-h-1", parsed({ homeScore: 3, awayScore: 1, corroboratedByLive: true })]]);
    const summary = applyFinishedResultsToTargets([espCpv], map);

    expect(summary).toEqual({ confirmed: 0, synced: 0, failed: 0 });
    expect(getResult("grp-h-1")).toBeNull();

    vi.useRealTimers();
  });

  it("ignores FT feed when live-scores still report in-play after the live window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T18:05:00.000Z"));

    const espCpv: Match = {
      id: "grp-h-1",
      stage: "group",
      group: "H",
      homeTeamId: "esp",
      awayTeamId: "cpv",
      date: "2026-06-15T16:00:00.000Z",
      venue: "Atlanta",
    };

    upsertLiveScore({
      matchId: "grp-h-1",
      homeScore: 0,
      awayScore: 0,
      status: "IN_PLAY",
      minute: "62",
    });

    const db = getDb();
    db.insert(actualResults)
      .values({
        matchId: "grp-h-1",
        homeScore: 3,
        awayScore: 1,
        et: 0,
        pens: 0,
        winnerTeamId: null,
        confirmed: 0,
        source: "test",
        syncedAt: "2026-06-15T18:00:00.000Z",
        confirmedAt: null,
        confirmedBy: null,
      })
      .run();

    const map = new Map([
      ["grp-h-1", parsed({ homeScore: 3, awayScore: 1, corroboratedByLive: true })],
    ]);
    const summary = applyFinishedResultsToTargets([espCpv], map);

    expect(summary.confirmed).toBe(0);
    expect(getResult("grp-h-1")?.confirmed).toBe(false);

    vi.useRealTimers();
  });

  it("confirms on first poll when last live score corroborates the FT line", () => {
    const map = new Map([["grp-b-2", parsed({ corroboratedByLive: true })]]);
    const summary = applyFinishedResultsToTargets([qatSui], map);

    expect(summary.confirmed).toBe(1);
    expect(getResult("grp-b-2")?.confirmed).toBe(true);
  });
});
