import { describe, expect, it } from "vitest";
import type { Match } from "@/lib/types";
import { listMatchesInLiveWindow } from "@/lib/match/live-window";
import { getMatchLifecycle } from "@/lib/match/lifecycle";
import { mapLiveApiToLocal } from "@/lib/jobs/poll-live-scores";
import type { BigBallsMatch } from "@/lib/results/big-balls/types";

const mexRsa: Match = {
  id: "grp-a-1",
  stage: "group",
  group: "A",
  homeTeamId: "mex",
  awayTeamId: "rsa",
  date: "2026-06-11T19:00:00.000Z",
  venue: "Mexico City",
};

describe("live window", () => {
  it("includes unconfirmed matches within 2h of kickoff", () => {
    const kickoff = new Date("2026-06-11T19:00:00.000Z").getTime();
    const during = listMatchesInLiveWindow(kickoff + 30 * 60_000);
    expect(during.some((m) => m.id === "grp-a-1")).toBe(true);
    expect(getMatchLifecycle(mexRsa.date, false, kickoff + 30 * 60_000)).toBe("live");
  });
});

describe("live score mapping", () => {
  it("maps Big Balls live rows to local fixtures", () => {
    const api: BigBallsMatch = {
      id: "bb_mex_rsa",
      kickoff_utc: "2026-06-11T19:00:00.000Z",
      status: "live",
      home: { name: "Mexico", abbr: "MEX" },
      away: { name: "South Africa", abbr: "RSA" },
      score: { home: 1, away: 0 },
      minute: 37,
    };

    const mapped = mapLiveApiToLocal([api], [mexRsa]);
    expect(mapped).toEqual([
      {
        matchId: "grp-a-1",
        homeScore: 1,
        awayScore: 0,
        status: "live",
        minute: "37",
      },
    ]);
  });

  it("maps in_progress API rows when live filter is empty", () => {
    const haiSco: Match = {
      id: "grp-c-2",
      stage: "group",
      group: "C",
      homeTeamId: "hai",
      awayTeamId: "sco",
      date: "2026-06-14T01:00:00.000Z",
      venue: "Boston",
    };
    const api: BigBallsMatch = {
      id: "bb_hai_sco",
      kickoff_utc: "2026-06-14T01:00:00.000Z",
      status: "in_progress",
      home_team: { team_name: "Haiti", abbr: "HAI" },
      away_team: { team_name: "Scotland", abbr: "SCO" },
      score: { home: 0, away: 1 },
      minute: 52,
    };

    const mapped = mapLiveApiToLocal([api], [haiSco]);
    expect(mapped[0]?.matchId).toBe("grp-c-2");
    expect(mapped[0]?.homeScore).toBe(0);
    expect(mapped[0]?.awayScore).toBe(1);
  });
});
