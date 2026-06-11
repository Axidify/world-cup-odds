import { afterEach, describe, expect, it, vi } from "vitest";
import { getNextResultsPollWindow, getResultsPollPlan } from "@/lib/jobs/poll-schedule";
import { RESULT_POLL_START_AFTER_MS } from "@/lib/jobs/poll-results";

describe("getNextResultsPollWindow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a future kickoff + buffer when no matches are pollable yet", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));

    const next = getNextResultsPollWindow();
    expect(next).not.toBeNull();
    expect(next!).toBeGreaterThan(Date.now());
  });

  it("is at least kickoff plus the results buffer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));

    const next = getNextResultsPollWindow();
    expect(next).toBeGreaterThan(Date.now() + RESULT_POLL_START_AFTER_MS - 60_000);
  });
});

describe("getResultsPollPlan", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips polling when idle before the next match window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));

    const plan = getResultsPollPlan(15 * 60 * 1000);
    if (plan.shouldPoll) {
      expect(plan.reason).toMatch(/awaiting results/);
    } else {
      expect(plan.delayMs).toBeGreaterThan(15 * 60 * 1000);
      expect(plan.reason).toMatch(/next results window/);
    }
  });
});
