import { describe, expect, it } from "vitest";
import { shouldRefreshForConfirmedResults } from "@/lib/results/confirmed-sync";

describe("shouldRefreshForConfirmedResults", () => {
  it("does not refresh on the first snapshot", () => {
    expect(
      shouldRefreshForConfirmedResults(null, { count: 3, latestConfirmedAt: "2026-06-17T01:00:00.000Z" }),
    ).toBe(false);
  });

  it("refreshes when confirmed count increases", () => {
    expect(
      shouldRefreshForConfirmedResults(
        { count: 3, latestConfirmedAt: "2026-06-17T01:00:00.000Z" },
        { count: 4, latestConfirmedAt: "2026-06-17T01:30:00.000Z" },
      ),
    ).toBe(true);
  });

  it("refreshes when latest confirm timestamp changes at the same count", () => {
    expect(
      shouldRefreshForConfirmedResults(
        { count: 3, latestConfirmedAt: "2026-06-17T01:00:00.000Z" },
        { count: 3, latestConfirmedAt: "2026-06-17T01:05:00.000Z" },
      ),
    ).toBe(true);
  });

  it("does not refresh when nothing changed", () => {
    const snap = { count: 5, latestConfirmedAt: "2026-06-17T02:00:00.000Z" };
    expect(shouldRefreshForConfirmedResults(snap, snap)).toBe(false);
  });

  it("refreshes when a result is reset or unconfirmed", () => {
    expect(
      shouldRefreshForConfirmedResults(
        { count: 5, latestConfirmedAt: "2026-06-17T02:00:00.000Z" },
        { count: 4, latestConfirmedAt: "2026-06-17T01:30:00.000Z" },
      ),
    ).toBe(true);
  });
});
