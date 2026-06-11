import { describe, it, expect } from "vitest";
import {
  buildBulkAnalyzeQueue,
  buildTop24Pairings,
  countBulkTargets,
  getTop24TeamIds,
  workItemForGap,
} from "@/lib/ai/preanalyze";
import { getFixtures, getMatch } from "@/lib/data/load";

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
    const { total, cached, remaining } = countBulkTargets();
    expect(total).toBe(348);
    expect(cached).toBe(0);
    expect(remaining).toBe(348);
  });

  it("uses pair analysis for knockout gaps when the fixture still has TBD teams", () => {
    const groupFx = getFixtures().find(
      (m) => m.homeTeamId !== "TBD" && m.awayTeamId !== "TBD",
    )!;
    expect(workItemForGap({
      homeTeamId: groupFx.homeTeamId,
      awayTeamId: groupFx.awayTeamId,
      stage: "group",
      matchId: groupFx.id,
    })).toEqual({
      kind: "match",
      matchId: groupFx.id,
      label: `${groupFx.homeTeamId} vs ${groupFx.awayTeamId} (group)`,
    });

    const koFx = getMatch("r32-1")!;
    expect(koFx.homeTeamId).toBe("TBD");
    expect(
      workItemForGap({
        homeTeamId: "kor",
        awayTeamId: "qat",
        stage: "r32",
        matchId: koFx.id,
      }),
    ).toEqual({
      kind: "pair",
      homeTeamId: "kor",
      awayTeamId: "qat",
      stage: "r32",
      label: "kor vs qat (r32)",
    });
  });
});
