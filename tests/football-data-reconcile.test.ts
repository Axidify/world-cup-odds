import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { actualResults } from "@/lib/db/schema";
import { getResult } from "@/lib/results/store";
import { reconcileFootballDataConfirmedResults } from "@/lib/results/football-data/poll";

vi.mock("@/lib/results/football-data/client", () => ({
  isFootballDataConfigured: () => true,
  fetchWorldCupMatches: vi.fn(),
  fetchFootballDataMatch: vi.fn(),
}));

import {
  fetchFootballDataMatch,
  fetchWorldCupMatches,
} from "@/lib/results/football-data/client";

describe("reconcileFootballDataConfirmedResults", () => {
  beforeEach(() => {
    const db = getDb();
    db.delete(actualResults).run();
    vi.clearAllMocks();
  });

  it("fixes stale auto-confirmed 0-0 when API reports the real score", async () => {
    const db = getDb();
    db.insert(actualResults)
      .values({
        matchId: "grp-b-2",
        homeScore: 0,
        awayScore: 0,
        et: 0,
        pens: 0,
        winnerTeamId: null,
        confirmed: 1,
        source: "football-data.org",
        syncedAt: "2026-06-13T21:00:00.000Z",
        confirmedAt: "2026-06-13T21:00:00.000Z",
        confirmedBy: "auto",
      })
      .run();

    const listRow = {
      id: 2001,
      utcDate: "2026-06-13T19:00:00.000Z",
      status: "FINISHED" as const,
      homeTeam: { name: "Qatar", tla: "QAT" },
      awayTeam: { name: "Switzerland", tla: "SUI" },
      score: { fullTime: { home: 0, away: 0 } },
    };
    const detailRow = {
      ...listRow,
      score: { fullTime: { home: 1, away: 1 }, winner: "DRAW" as const },
    };

    vi.mocked(fetchWorldCupMatches).mockResolvedValue([listRow]);
    vi.mocked(fetchFootballDataMatch).mockResolvedValue(detailRow);

    const fixed = await reconcileFootballDataConfirmedResults();

    expect(fixed).toBe(1);
    const row = getResult("grp-b-2");
    expect(row?.confirmed).toBe(true);
    expect(row?.homeScore).toBe(1);
    expect(row?.awayScore).toBe(1);
    expect(row?.confirmedBy).toBe("auto");
  });

  it("leaves admin-confirmed scores unchanged", async () => {
    const db = getDb();
    db.insert(actualResults)
      .values({
        matchId: "grp-c-2",
        homeScore: 0,
        awayScore: 1,
        et: 0,
        pens: 0,
        winnerTeamId: null,
        confirmed: 1,
        source: "admin",
        syncedAt: "2026-06-14T03:00:00.000Z",
        confirmedAt: "2026-06-14T03:00:00.000Z",
        confirmedBy: "admin",
      })
      .run();

    vi.mocked(fetchWorldCupMatches).mockResolvedValue([
      {
        id: 2002,
        utcDate: "2026-06-14T01:00:00.000Z",
        status: "FINISHED",
        homeTeam: { name: "Haiti", tla: "HAI" },
        awayTeam: { name: "Scotland", tla: "SCO" },
        score: { fullTime: { home: 0, away: 1 }, winner: "AWAY_TEAM" },
      },
    ]);

    const fixed = await reconcileFootballDataConfirmedResults();

    expect(fixed).toBe(0);
    expect(getResult("grp-c-2")?.awayScore).toBe(1);
    expect(fetchFootballDataMatch).not.toHaveBeenCalled();
  });
});
