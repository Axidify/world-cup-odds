import { describe, expect, it } from "vitest";
import { shouldRefreshForSimulation } from "@/lib/tournament/status-sync";

describe("shouldRefreshForSimulation", () => {
  it("does not refresh on the first snapshot", () => {
    expect(shouldRefreshForSimulation(null, { runAt: "2026-06-17T06:19:00.000Z" })).toBe(false);
  });

  it("refreshes when runAt changes", () => {
    expect(
      shouldRefreshForSimulation(
        { runAt: "2026-06-17T06:19:00.000Z" },
        { runAt: "2026-06-17T07:00:00.000Z" },
      ),
    ).toBe(true);
  });

  it("does not refresh when runAt unchanged", () => {
    const snap = { runAt: "2026-06-17T06:19:00.000Z" };
    expect(shouldRefreshForSimulation(snap, snap)).toBe(false);
  });

  it("refreshes when simulation appears after none", () => {
    expect(
      shouldRefreshForSimulation({ runAt: null }, { runAt: "2026-06-17T06:19:00.000Z" }),
    ).toBe(true);
  });
});
