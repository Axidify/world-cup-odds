import { describe, expect, it } from "vitest";
import { formatTeamStrengthBlock } from "@/lib/ai/team-strength";
import { getTeam } from "@/lib/data/load";

describe("formatTeamStrengthBlock", () => {
  it("leads with World Football Elo from eloratings.net", () => {
    const block = formatTeamStrengthBlock(getTeam("mex")!);
    expect(block).toContain("World Football Elo: 1881");
    expect(block).toContain("eloratings.net");
    expect(block).toContain("FIFA rank: #14");
  });
});
