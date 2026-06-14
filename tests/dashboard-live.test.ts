import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { actualResults } from "@/lib/db/schema";
import { getDashboardLiveMatches } from "@/lib/match/dashboard-live";
import { getMatchLifecycle } from "@/lib/match/lifecycle";
import { MATCH_RESULTS_CHECK_MS } from "@/lib/match/lifecycle";

describe("dashboard live matches", () => {
  beforeEach(() => {
    getDb().delete(actualResults).run();
  });
  const haiScoKickoff = Date.parse("2026-06-14T01:00:00.000Z");

  it("treats kickoff + 30m as live lifecycle", () => {
    expect(getMatchLifecycle("2026-06-14T01:00:00.000Z", false, haiScoKickoff + 30 * 60_000)).toBe(
      "live",
    );
    expect(haiScoKickoff + MATCH_RESULTS_CHECK_MS).toBeGreaterThan(haiScoKickoff + 30 * 60_000);
  });

  it("lists unconfirmed fixtures in the live window", () => {
    const during = getDashboardLiveMatches(haiScoKickoff + 30 * 60_000);
    const haiSco = during.find((m) => m.matchId === "grp-c-2");
    expect(haiSco).toMatchObject({
      matchId: "grp-c-2",
      homeName: "Haiti",
      awayName: "Scotland",
      group: "C",
    });
  });

  it("excludes fixtures outside the live window", () => {
    const beforeKickoff = getDashboardLiveMatches(haiScoKickoff - 60_000);
    expect(beforeKickoff.some((m) => m.matchId === "grp-c-2")).toBe(false);
  });
});
