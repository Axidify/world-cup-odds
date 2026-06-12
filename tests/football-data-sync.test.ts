import { describe, expect, it } from "vitest";
import type { FootballDataMatch } from "@/lib/results/football-data/types";
import {
  indexFinishedMatches,
  kickoffsAlign,
  linksApiMatchToLocal,
  parseFinishedApiMatch,
} from "@/lib/results/football-data/sync";
import { resolveTeamIdFromApi } from "@/lib/results/football-data/team-tla";
import type { Match } from "@/lib/types";

const korCze: Match = {
  id: "grp-a-2",
  stage: "group",
  group: "A",
  homeTeamId: "kor",
  awayTeamId: "cze",
  date: "2026-06-12T02:00:00.000Z",
  venue: "Guadalajara",
};

function apiMatch(overrides: Partial<FootballDataMatch> = {}): FootballDataMatch {
  return {
    id: 999,
    utcDate: "2026-06-12T02:00:00.000Z",
    status: "FINISHED",
    homeTeam: { name: "Korea Republic", shortName: "Korea Republic", tla: "KOR" },
    awayTeam: { name: "Czechia", shortName: "Czechia", tla: "CZE" },
    score: {
      winner: "HOME_TEAM",
      duration: "REGULAR",
      fullTime: { home: 2, away: 1 },
    },
    ...overrides,
  };
}

describe("football-data sync", () => {
  it("maps API team TLAs to local ids", () => {
    expect(resolveTeamIdFromApi({ tla: "KOR" })).toBe("kor");
    expect(resolveTeamIdFromApi({ name: "Czechia" })).toBe("cze");
  });

  it("aligns kickoffs within tolerance", () => {
    expect(kickoffsAlign("2026-06-12T02:00:00.000Z", "2026-06-12T02:00:00.000Z")).toBe(true);
    expect(kickoffsAlign("2026-06-12T02:00:00.000Z", "2026-06-12T03:30:00.000Z")).toBe(true);
    expect(kickoffsAlign("2026-06-12T02:00:00.000Z", "2026-06-13T02:00:00.000Z")).toBe(false);
  });

  it("links local fixtures to API matches", () => {
    expect(linksApiMatchToLocal(apiMatch(), korCze)).toBe(true);
    expect(linksApiMatchToLocal(apiMatch({ status: "IN_PLAY" }), korCze)).toBe(true);
  });

  it("parses only finished matches", () => {
    expect(parseFinishedApiMatch(apiMatch({ status: "IN_PLAY" }), korCze)).toBeNull();
    expect(parseFinishedApiMatch(apiMatch(), korCze)).toEqual({
      apiMatchId: 999,
      homeScore: 2,
      awayScore: 1,
      et: false,
      pens: false,
      winnerTeamId: null,
      source: expect.stringContaining("football-data.org"),
    });
  });

  it("indexes finished API matches by local id", () => {
    const index = indexFinishedMatches(
      [apiMatch(), apiMatch({ id: 1000, status: "IN_PLAY" })],
      [korCze],
    );
    expect(index.get("grp-a-2")?.homeScore).toBe(2);
  });
});
