import { describe, expect, it } from "vitest";
import {
  isFootballData429Error,
  parseFootballData429WaitMs,
} from "@/lib/results/football-data/request";

describe("football-data 429 handling", () => {
  it("parses wait seconds from rate-limit message", () => {
    expect(
      parseFootballData429WaitMs(
        'football-data.org 429: {"message":"You reached your request limit. Wait 57 seconds."}',
      ),
    ).toBe(57_000);
  });

  it("detects 429 errors", () => {
    expect(isFootballData429Error(new Error("football-data.org 429: rate limit"))).toBe(true);
    expect(isFootballData429Error(new Error("football-data.org 500"))).toBe(false);
  });
});
