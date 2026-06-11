import { describe, it, expect } from "vitest";
import { buildOfficialKnockoutPath } from "@/lib/bracket/official-knockout";
import type { PlayedMatchResult } from "@/lib/types";

describe("buildOfficialKnockoutPath", () => {
  it("returns empty path when no results are confirmed", () => {
    const path = buildOfficialKnockoutPath(new Map());
    expect(path.knockout).toEqual([]);
    expect(path.championTeamId).toBeUndefined();
    expect(path.groupsComplete).toBe(false);
    expect(path.hasConfirmedKnockoutResults).toBe(false);
  });

  it("flags confirmed knockout results even before teams can be resolved", () => {
    const confirmed = new Map<string, PlayedMatchResult>([
      [
        "sf-1",
        {
          matchId: "sf-1",
          homeTeamId: "arg",
          awayTeamId: "fra",
          homeGoals: 2,
          awayGoals: 1,
          winnerTeamId: "arg",
        },
      ],
    ]);

    const path = buildOfficialKnockoutPath(confirmed);
    expect(path.hasConfirmedKnockoutResults).toBe(true);
    expect(path.knockout.find((m) => m.matchId === "sf-1")).toBeUndefined();
  });
});
