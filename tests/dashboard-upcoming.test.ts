import { describe, it, expect } from "vitest";
import {
  isDashboardComingUpMatch,
  isKickoffTodayOrTomorrow,
  isUpcomingKickoff,
} from "@/lib/match/dashboard-upcoming";

describe("dashboard upcoming matches", () => {
  const now = Date.parse("2026-06-15T18:00:00.000Z");
  const tz = "UTC";

  it("excludes kickoffs that already passed today", () => {
    expect(isUpcomingKickoff("2026-06-15T12:00:00.000Z", now)).toBe(false);
    expect(isDashboardComingUpMatch("2026-06-15T12:00:00.000Z", now)).toBe(false);
  });

  it("includes later kickoffs today", () => {
    expect(isKickoffTodayOrTomorrow("2026-06-15T20:00:00.000Z", now, tz)).toBe(true);
    expect(isDashboardComingUpMatch("2026-06-15T20:00:00.000Z", now)).toBe(true);
  });

  it("includes tomorrow but not yesterday", () => {
    expect(isKickoffTodayOrTomorrow("2026-06-14T20:00:00.000Z", now, tz)).toBe(false);
    expect(isKickoffTodayOrTomorrow("2026-06-16T12:00:00.000Z", now, tz)).toBe(true);
    expect(isDashboardComingUpMatch("2026-06-16T12:00:00.000Z", now)).toBe(true);
  });
});
