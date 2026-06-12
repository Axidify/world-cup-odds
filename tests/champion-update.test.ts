import { describe, expect, it } from "vitest";
import { diffChampionOdds } from "@/lib/sim/champion-update";

describe("diffChampionOdds", () => {
  it("ranks teams by absolute probability change", () => {
    const before = { arg: 20, bra: 15, fra: 10 };
    const after = { arg: 22, bra: 12, fra: 10 };
    const changes = diffChampionOdds(before, after, ["arg", "bra", "fra"]);
    expect(changes[0].teamId).toBe("bra");
    expect(changes[0].delta).toBe(-3);
    expect(changes[1].teamId).toBe("arg");
    expect(changes[1].delta).toBe(2);
  });

  it("ignores tiny moves below threshold", () => {
    const before = { arg: 10 };
    const after = { arg: 10.02 };
    expect(diffChampionOdds(before, after, ["arg"])).toEqual([]);
  });
});
