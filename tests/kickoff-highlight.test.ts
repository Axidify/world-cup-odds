import { describe, expect, it } from "vitest";
import { getKickoffHighlight } from "@/lib/match/kickoff-highlight";

const TZ = "UTC";

describe("getKickoffHighlight", () => {
  it("returns live for in-progress matches", () => {
    const kickoff = "2026-06-15T18:00:00.000Z";
    const now = Date.parse("2026-06-15T19:00:00.000Z");
    expect(getKickoffHighlight(kickoff, "live", now, TZ)).toBe("live");
  });

  it("returns later_today for upcoming kickoff on the same calendar day", () => {
    const kickoff = "2026-06-15T20:00:00.000Z";
    const now = Date.parse("2026-06-15T10:00:00.000Z");
    expect(getKickoffHighlight(kickoff, "upcoming", now, TZ)).toBe("later_today");
  });

  it("returns tomorrow for the next calendar day", () => {
    const kickoff = "2026-06-16T15:00:00.000Z";
    const now = Date.parse("2026-06-15T22:00:00.000Z");
    expect(getKickoffHighlight(kickoff, "upcoming", now, TZ)).toBe("tomorrow");
  });

  it("returns null for confirmed or distant fixtures", () => {
    const kickoff = "2026-06-20T15:00:00.000Z";
    const now = Date.parse("2026-06-15T10:00:00.000Z");
    expect(getKickoffHighlight(kickoff, "confirmed", now, TZ)).toBe(null);
    expect(getKickoffHighlight(kickoff, "upcoming", now, TZ)).toBe(null);
  });
});
