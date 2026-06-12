import { afterEach, describe, expect, it, vi } from "vitest";
import { getMatchLifecycle, getResultsCheckAtMs } from "@/lib/match/lifecycle";

describe("getMatchLifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns upcoming before kickoff", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T18:00:00.000Z"));
    expect(getMatchLifecycle("2026-06-11T20:00:00.000Z", false)).toBe("upcoming");
  });

  it("returns live between kickoff and results check window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T21:00:00.000Z"));
    expect(getMatchLifecycle("2026-06-11T20:00:00.000Z", false)).toBe("live");
  });

  it("returns awaiting_result after results check window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T23:00:00.000Z"));
    expect(getMatchLifecycle("2026-06-11T20:00:00.000Z", false)).toBe("awaiting_result");
  });

  it("returns confirmed when result is in", () => {
    expect(getMatchLifecycle("2026-06-11T20:00:00.000Z", true)).toBe("confirmed");
  });

  it("results check is kickoff plus two hours", () => {
    expect(getResultsCheckAtMs("2026-06-11T20:00:00.000Z")).toBe(
      Date.parse("2026-06-11T22:00:00.000Z"),
    );
  });
});
