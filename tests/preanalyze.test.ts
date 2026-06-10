import { describe, it, expect } from "vitest";
import {
  buildBulkAnalyzeQueue,
  buildTop24Pairings,
  countBulkTargets,
  getTop24TeamIds,
} from "@/lib/ai/preanalyze";
import { getFixtures } from "@/lib/data/load";

describe("preanalyze", () => {
  it("selects top 24 teams by FIFA rank", () => {
    const ids = getTop24TeamIds();
    expect(ids).toHaveLength(24);
  });

  it("builds 276 top-24 pairings", () => {
    expect(buildTop24Pairings()).toHaveLength(276);
  });

  it("baseline bulk target is 72 group matches + 276 top-24 pairings", () => {
    const groupCount = getFixtures().filter(
      (m) => m.homeTeamId !== "TBD" && m.awayTeamId !== "TBD",
    ).length;
    expect(groupCount).toBe(72);
    expect(groupCount + buildTop24Pairings().length).toBe(348);
  });

  it("returns empty queue when no LLM provider is configured", () => {
    expect(buildBulkAnalyzeQueue({ refresh: true })).toEqual([]);
  });

  it("reports zero cached when no LLM provider is configured", () => {
    const { total, cached } = countBulkTargets();
    expect(total).toBe(348);
    expect(cached).toBe(0);
  });
});
