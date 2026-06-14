import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { liveScores } from "@/lib/db/schema";
import {
  applyLastLiveScoreToFinished,
  getCorroboratingLiveScore,
} from "@/lib/results/live-snapshot";
import { pruneLiveScores, upsertLiveScore } from "@/lib/results/live-scores/store";
import { actualResults } from "@/lib/db/schema";

describe("live snapshot for FT confirmation", () => {
  beforeEach(() => {
    const db = getDb();
    db.delete(liveScores).run();
    db.delete(actualResults).run();
  });

  it("returns a recent live row as corroborating evidence", () => {
    upsertLiveScore({
      matchId: "grp-b-2",
      homeScore: 1,
      awayScore: 1,
      status: "IN_PLAY",
      minute: "88",
    });

    const live = getCorroboratingLiveScore("grp-b-2");
    expect(live?.homeScore).toBe(1);
    expect(live?.awayScore).toBe(1);
  });

  it("prefers last live score when FINISHED feed is stale 0-0", () => {
    upsertLiveScore({
      matchId: "grp-b-2",
      homeScore: 1,
      awayScore: 1,
      status: "IN_PLAY",
      minute: "90+2",
    });

    const parsed = applyLastLiveScoreToFinished("grp-b-2", {
      homeScore: 0,
      awayScore: 0,
      et: false,
      pens: false,
      winnerTeamId: null,
      source: "api",
      listDetailAgree: false,
    });

    expect(parsed.homeScore).toBe(1);
    expect(parsed.awayScore).toBe(1);
    expect(parsed.corroboratedByLive).toBe(true);
  });

  it("keeps unconfirmed live snapshots after the match leaves the live feed", () => {
    upsertLiveScore({
      matchId: "grp-b-2",
      homeScore: 1,
      awayScore: 1,
      status: "IN_PLAY",
      minute: "90",
    });

    pruneLiveScores([]);

    expect(getCorroboratingLiveScore("grp-b-2")?.homeScore).toBe(1);
  });

  it("drops live snapshots once the result is confirmed", () => {
    const db = getDb();
    upsertLiveScore({
      matchId: "grp-b-2",
      homeScore: 1,
      awayScore: 1,
      status: "IN_PLAY",
      minute: "90",
    });
    db.insert(actualResults)
      .values({
        matchId: "grp-b-2",
        homeScore: 1,
        awayScore: 1,
        et: 0,
        pens: 0,
        winnerTeamId: null,
        confirmed: 1,
        source: "test",
        syncedAt: "2026-06-13T21:00:00.000Z",
        confirmedAt: "2026-06-13T21:00:00.000Z",
        confirmedBy: "auto",
      })
      .run();

    pruneLiveScores([]);

    expect(getCorroboratingLiveScore("grp-b-2")).toBeNull();
  });
});
