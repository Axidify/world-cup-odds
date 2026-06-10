import { describe, it, expect } from "vitest";
import {
  getThirdPlaceMapping,
  thirdPlaceCombinationKey,
  resolveGroupSlot,
} from "@/lib/bracket";
import type { GroupStanding } from "@/lib/types";

describe("bracket", () => {
  it("builds stable third-place combination keys", () => {
    expect(thirdPlaceCombinationKey(["C", "D", "E", "F", "G", "I", "K", "L"])).toBe("CDEFGIKL");
  });

  it("loads Annex C mapping for known combination", () => {
    const mapping = getThirdPlaceMapping(["E", "F", "G", "H", "I", "J", "K", "L"]);
    expect(mapping["1A"]).toBe("3E");
    expect(mapping["1B"]).toBe("3J");
  });

  it("resolves group winner and runner-up slots", () => {
    const standings: Record<string, GroupStanding[]> = {
      A: [
        { teamId: "mex", group: "A", played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 2, goalDifference: 3, points: 7, position: 1 },
        { teamId: "kor", group: "A", played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, goalDifference: 0, points: 4, position: 2 },
      ],
    };
    expect(resolveGroupSlot("1A", standings)).toBe("mex");
    expect(resolveGroupSlot("2A", standings)).toBe("kor");
  });
});
