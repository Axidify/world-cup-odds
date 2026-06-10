import { describe, it, expect } from "vitest";
import {
  getTeams,
  getGroups,
  getFixtures,
  getKnockoutFixtures,
  getAllMatches,
  getBracketTemplate,
} from "@/lib/data/load";

describe("seed data", () => {
  it("has 48 teams", () => {
    expect(getTeams()).toHaveLength(48);
  });

  it("has 12 groups of 4", () => {
    const groups = getGroups();
    expect(groups).toHaveLength(12);
    groups.forEach((g) => expect(g.teamIds).toHaveLength(4));
  });

  it("has 72 group + 32 knockout = 104 matches", () => {
    expect(getFixtures()).toHaveLength(72);
    expect(getKnockoutFixtures()).toHaveLength(32);
    expect(getAllMatches()).toHaveLength(104);
  });

  it("has unique match ids", () => {
    const ids = getAllMatches().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("opening match is Mexico vs South Africa on Jun 11", () => {
    const opener = getFixtures().find((m) => m.id === "grp-a-1");
    expect(opener).toBeDefined();
    expect(opener!.homeTeamId).toBe("mex");
    expect(opener!.awayTeamId).toBe("rsa");
    expect(opener!.date).toBe("2026-06-11T19:00:00.000Z");
  });

  it("group stage ends before knockout begins", () => {
    const lastGroup = getFixtures()
      .map((m) => m.date)
      .sort()
      .at(-1)!;
    const firstKo = getKnockoutFixtures()
      .map((m) => m.date)
      .sort()[0];
    expect(lastGroup < firstKo).toBe(true);
  });

  it("group stage fits FIFA window (Jun 11–27)", () => {
    const dates = getFixtures().map((m) => m.date).sort();
    expect(dates[0] >= "2026-06-11").toBe(true);
    expect(dates.at(-1)! <= "2026-06-28").toBe(true);
  });

  it("knockout rounds do not overlap", () => {
    const ko = getKnockoutFixtures();
    const byStage = new Map<string, string[]>();
    for (const m of ko) {
      const dates = byStage.get(m.stage) ?? [];
      dates.push(m.date);
      byStage.set(m.stage, dates);
    }
    const order = ["r32", "r16", "qf", "sf", "third_place", "final"] as const;
    for (let i = 0; i < order.length - 1; i++) {
      const current = byStage.get(order[i])!.sort();
      const next = byStage.get(order[i + 1])!.sort();
      expect(current.at(-1)! < next[0]).toBe(true);
    }
  });

  it("bracket template r32 ids match knockout fixtures", () => {
    const template = getBracketTemplate();
    const koIds = new Set(getKnockoutFixtures().filter((m) => m.stage === "r32").map((m) => m.id));
    template.r32.forEach((slot) => {
      expect(koIds.has(slot.matchId)).toBe(true);
    });
  });

  it("knockout progression slots reference valid matches", () => {
    const ko = getKnockoutFixtures();
    const ids = new Set(ko.map((m) => m.id));
    for (const m of ko) {
      for (const slot of [m.homeSlot, m.awaySlot]) {
        if (!slot) continue;
        const ref = slot.slice(2);
        expect(ids.has(ref)).toBe(true);
      }
    }
  });
});
