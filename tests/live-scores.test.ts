import { describe, expect, it } from "vitest";
import type { Match } from "@/lib/types";
import type { FootballDataMatch } from "@/lib/results/football-data/types";
import { getMatchLifecycle } from "@/lib/match/lifecycle";
import { mapLiveFootballDataToLocal } from "@/lib/results/football-data";

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
  it("treats kickoff + 30m as live before results check window", () => {
    const kickoff = new Date("2026-06-11T19:00:00.000Z").getTime();
    expect(getMatchLifecycle(mexRsa.date, false, kickoff + 30 * 60_000)).toBe("live");
  });
});

describe("live score mapping", () => {
  it("maps football-data live rows to local fixtures", () => {
    const api: FootballDataMatch = {
      id: 1001,
      utcDate: "2026-06-11T19:00:00.000Z",
      status: "IN_PLAY",
      homeTeam: { name: "Mexico", tla: "MEX" },
      awayTeam: { name: "South Africa", tla: "RSA" },
      score: { fullTime: { home: 1, away: 0 } },
      minute: 37,
    };

    const mapped = mapLiveFootballDataToLocal([api], [mexRsa]);
    expect(mapped).toEqual([
      {
        matchId: "grp-a-1",
        homeScore: 1,
        awayScore: 0,
        status: "IN_PLAY",
        minute: "37",
      },
    ]);
  });

  it("maps PAUSED rows with HT minute label", () => {
    const haiSco: Match = {
      id: "grp-c-2",
      stage: "group",
      group: "C",
      homeTeamId: "hai",
      awayTeamId: "sco",
      date: "2026-06-14T01:00:00.000Z",
      venue: "Boston",
    };
    const api: FootballDataMatch = {
      id: 1002,
      utcDate: "2026-06-14T01:00:00.000Z",
      status: "PAUSED",
      homeTeam: { name: "Haiti", tla: "HAI" },
      awayTeam: { name: "Scotland", tla: "SCO" },
      score: { halfTime: { home: 0, away: 1 } },
    };

    const mapped = mapLiveFootballDataToLocal([api], [haiSco]);
    expect(mapped[0]?.matchId).toBe("grp-c-2");
    expect(mapped[0]?.homeScore).toBe(0);
    expect(mapped[0]?.awayScore).toBe(1);
    expect(mapped[0]?.minute).toBe("HT");
  });
});
