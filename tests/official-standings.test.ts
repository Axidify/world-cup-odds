import { describe, expect, it } from "vitest";
import { buildOfficialStandingsByGroup } from "@/lib/standings/official-standings";
import type { PlayedMatchResult } from "@/lib/types";

describe("buildOfficialStandingsByGroup", () => {
  it("awards points only from confirmed group matches", () => {
    const confirmed = new Map<string, PlayedMatchResult>([
      [
        "grp-a-1",
        {
          matchId: "grp-a-1",
          homeTeamId: "mex",
          awayTeamId: "rsa",
          homeGoals: 2,
          awayGoals: 0,
        },
      ],
    ]);

    const standings = buildOfficialStandingsByGroup(confirmed);
    const groupA = standings.A;
    const mex = groupA.find((s) => s.teamId === "mex");
    const rsa = groupA.find((s) => s.teamId === "rsa");

    expect(mex?.points).toBe(3);
    expect(mex?.played).toBe(1);
    expect(rsa?.points).toBe(0);
    expect(rsa?.played).toBe(1);
  });
});
