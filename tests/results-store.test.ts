import { describe, it, expect } from "vitest";
import { upsertPendingResult } from "@/lib/results/store";

describe("results store", () => {
  it("rejects negative pending scores", () => {
    expect(() =>
      upsertPendingResult({
        matchId: "test-unconfirmed-fixture",
        homeScore: -1,
        awayScore: 0,
      }),
    ).toThrow("Invalid match scores");
  });
});
