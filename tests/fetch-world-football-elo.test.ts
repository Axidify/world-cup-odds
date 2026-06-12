import { describe, expect, it } from "vitest";
import { parseWorldFootballEloTsv } from "@/lib/calibration/fetch-world-football-elo";
import { TEAM_ID_TO_ELO_CODE } from "@/lib/calibration/world-football-elo";

describe("parseWorldFootballEloTsv", () => {
  it("maps eloratings codes to team ids", () => {
    const tsv = Object.entries(TEAM_ID_TO_ELO_CODE)
      .map(([teamId, code], i) => {
        const rating = teamId === "mex" ? 1881 : teamId === "rsa" ? 1511 : 1500 + i;
        return `${i + 1}\t1\t${code}\t${rating}`;
      })
      .join("\n");
    const ratings = parseWorldFootballEloTsv(tsv);
    expect(ratings.mex).toBe(1881);
    expect(ratings.rsa).toBe(1511);
  });
});
