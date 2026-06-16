import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Match } from "@/lib/types";
import { getDb } from "@/lib/db";
import { actualResults, liveScores } from "@/lib/db/schema";
import { listMatchesInLiveWindow } from "@/lib/match/live-window";
import { upsertLiveScore } from "@/lib/results/live-scores/store";

const irnNzl: Match = {
  id: "grp-g-2",
  stage: "group",
  group: "G",
  homeTeamId: "irn",
  awayTeamId: "nzl",
  date: "2026-06-16T01:00:00.000Z",
  venue: "Los Angeles",
};

describe("listMatchesInLiveWindow", () => {
  beforeEach(() => {
    const db = getDb();
    db.delete(actualResults).run();
    db.delete(liveScores).run();
    vi.useRealTimers();
  });

  it("includes fixtures past 2h when live feed still reports in-play", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T03:10:00.000Z"));

    upsertLiveScore({
      matchId: "grp-g-2",
      homeScore: 2,
      awayScore: 2,
      status: "IN_PLAY",
      minute: "90",
    });

    const live = listMatchesInLiveWindow();
    expect(live.some((m) => m.id === "grp-g-2")).toBe(true);

    vi.useRealTimers();
  });

  it("excludes fixtures past 2h when live feed is absent", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T03:10:00.000Z"));

    const live = listMatchesInLiveWindow();
    expect(live.some((m) => m.id === irnNzl.id)).toBe(false);

    vi.useRealTimers();
  });
});
