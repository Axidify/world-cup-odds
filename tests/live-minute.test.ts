import { describe, expect, it } from "vitest";
import { formatLiveMinuteDisplay } from "@/lib/match/live-minute";
import {
  enrichLiveFootballDataMatches,
  formatLiveFootballDataMinute,
} from "@/lib/results/football-data/sync";
import type { FootballDataMatch } from "@/lib/results/football-data/types";

describe("formatLiveFootballDataMinute", () => {
  it("formats injury time", () => {
    expect(
      formatLiveFootballDataMinute({
        id: 1,
        utcDate: "2026-06-14T01:00:00.000Z",
        status: "IN_PLAY",
        homeTeam: {},
        awayTeam: {},
        minute: 45,
        injuryTime: 2,
      }),
    ).toBe("45+2");
  });
});

describe("enrichLiveFootballDataMatches", () => {
  it("fetches detail when list row has no minute", async () => {
    const list: FootballDataMatch = {
      id: 99,
      utcDate: "2026-06-14T01:00:00.000Z",
      status: "IN_PLAY",
      homeTeam: { tla: "HAI" },
      awayTeam: { tla: "SCO" },
      score: { fullTime: { home: 0, away: 1 } },
    };

    const enriched = await enrichLiveFootballDataMatches([list], async (id) => ({
      ...list,
      id,
      minute: 52,
    }));

    expect(enriched[0]?.minute).toBe(52);
    expect(formatLiveFootballDataMinute(enriched[0]!)).toBe("52");
  });
});

describe("formatLiveMinuteDisplay", () => {
  it("adds prime suffix for API minutes", () => {
    expect(
      formatLiveMinuteDisplay(
        { minute: "52", status: "IN_PLAY" },
        "2026-06-14T01:00:00.000Z",
      ),
    ).toBe("52'");
  });

  it("estimates from kickoff when API minute is missing", () => {
    const kickoff = "2026-06-14T01:00:00.000Z";
    const now = new Date(kickoff).getTime() + 38 * 60_000;
    expect(
      formatLiveMinuteDisplay({ minute: null, status: "IN_PLAY" }, kickoff, now),
    ).toBe("~38'");
  });
});
