import { describe, it, expect } from "vitest";
import {
  applyGroupResult,
  buildGroupStandings,
  rankThirdPlaceTeams,
  sortGroupStandings,
} from "@/lib/standings";
import type { GroupStanding, PlayedMatchResult } from "@/lib/types";

describe("standings", () => {
  it("awards points and goal difference", () => {
    const map = new Map<string, GroupStanding>([
      ["a", { teamId: "a", group: "A", played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, position: 0 }],
      ["b", { teamId: "b", group: "A", played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, position: 0 }],
    ]);
    applyGroupResult(map, {
      matchId: "m1",
      homeTeamId: "a",
      awayTeamId: "b",
      homeGoals: 2,
      awayGoals: 1,
    });
    expect(map.get("a")!.points).toBe(3);
    expect(map.get("b")!.points).toBe(0);
    expect(map.get("a")!.goalDifference).toBe(1);
  });

  it("sorts group table by points", () => {
    const results: PlayedMatchResult[] = [
      { matchId: "1", homeTeamId: "a", awayTeamId: "b", homeGoals: 1, awayGoals: 0 },
      { matchId: "2", homeTeamId: "c", awayTeamId: "d", homeGoals: 2, awayGoals: 2 },
      { matchId: "3", homeTeamId: "a", awayTeamId: "c", homeGoals: 0, awayGoals: 0 },
    ];
    const raw = buildGroupStandings("A", ["a", "b", "c", "d"], results);
    const sorted = sortGroupStandings(raw, results, new Map([
      ["a", 10],
      ["b", 20],
      ["c", 30],
      ["d", 40],
    ]));
    expect(sorted[0].teamId).toBe("a");
    expect(sorted[0].position).toBe(1);
  });

  it("ranks third-place teams across groups", () => {
    const third: GroupStanding[] = [
      { teamId: "x", group: "A", played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, goalDifference: 0, points: 4, position: 3 },
      { teamId: "y", group: "B", played: 3, won: 0, drawn: 2, lost: 1, goalsFor: 2, goalsAgainst: 3, goalDifference: -1, points: 2, position: 3 },
    ];
    const ranked = rankThirdPlaceTeams(third, new Map([["x", 5], ["y", 50]]));
    expect(ranked[0].teamId).toBe("x");
  });
});
