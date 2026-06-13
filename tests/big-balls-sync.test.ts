import { describe, expect, it } from "vitest";
import type { Match } from "@/lib/types";
import type { BigBallsMatch } from "@/lib/results/big-balls/types";
import {
  indexFinishedBigBallsMatches,
  linksBigBallsMatchToLocal,
  parseFinishedBigBallsMatch,
} from "@/lib/results/big-balls/sync";
import { resolveTeamIdFromBigBalls } from "@/lib/results/big-balls/team";
import { isFinishedStatus } from "@/lib/results/big-balls/client";
import { resolveResultsProviderChain } from "@/lib/jobs/poll-results";

const korCze: Match = {
  id: "grp-a-2",
  stage: "group",
  group: "A",
  homeTeamId: "kor",
  awayTeamId: "cze",
  date: "2026-06-12T02:00:00.000Z",
  venue: "Guadalajara",
};

function apiMatch(overrides: Partial<BigBallsMatch> = {}): BigBallsMatch {
  return {
    id: "bb_match_kor_cze",
    kickoff_utc: "2026-06-12T02:00:00.000Z",
    status: "finished",
    home: { name: "Korea Republic", abbr: "KOR" },
    away: { name: "Czechia", abbr: "CZE" },
    score: { home: 2, away: 1 },
    ...overrides,
  };
}

describe("big-balls sync", () => {
  it("maps API team abbreviations to local ids", () => {
    expect(resolveTeamIdFromBigBalls({ abbr: "KOR" })).toBe("kor");
    expect(resolveTeamIdFromBigBalls("Czechia")).toBe("cze");
  });

  it("detects finished statuses", () => {
    expect(isFinishedStatus("finished")).toBe(true);
    expect(isFinishedStatus("FINISHED")).toBe(true);
    expect(isFinishedStatus("in_progress")).toBe(false);
  });

  it("links local fixtures to API matches", () => {
    expect(linksBigBallsMatchToLocal(apiMatch(), korCze)).toBe(true);
    expect(linksBigBallsMatchToLocal(apiMatch({ status: "in_progress" }), korCze)).toBe(true);
  });

  it("parses only finished matches", () => {
    expect(parseFinishedBigBallsMatch(apiMatch({ status: "in_progress" }), korCze)).toBeNull();
    expect(parseFinishedBigBallsMatch(apiMatch(), korCze)).toEqual({
      homeScore: 2,
      awayScore: 1,
      et: false,
      pens: false,
      winnerTeamId: null,
      source: expect.stringContaining("bigballsdata.com"),
    });
  });

  it("indexes finished API matches by local id", () => {
    const index = indexFinishedBigBallsMatches(
      [apiMatch(), apiMatch({ id: "bb_other", status: "in_progress" })],
      [korCze],
    );
    expect(index.get("grp-a-2")?.homeScore).toBe(2);
  });
});

describe("results provider chain", () => {
  it("orders football-data before big-balls before search", () => {
    const prevFd = process.env.FOOTBALL_DATA_API_TOKEN;
    const prevBbs = process.env.BBS_API_KEY;
    const prevTavily = process.env.TAVILY_API_KEY;
    process.env.FOOTBALL_DATA_API_TOKEN = "fd";
    process.env.BBS_API_KEY = "bbs";
    process.env.TAVILY_API_KEY = "tav";
    expect(resolveResultsProviderChain()).toEqual(["football-data", "big-balls", "search"]);
    process.env.FOOTBALL_DATA_API_TOKEN = prevFd;
    process.env.BBS_API_KEY = prevBbs;
    process.env.TAVILY_API_KEY = prevTavily;
  });
});
