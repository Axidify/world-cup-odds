import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPredictionCacheTtlMs, isPredictionExpired } from "@/lib/ai/cache-ttl";

describe("cache-ttl", () => {
  const original = process.env.PREDICTION_CACHE_TTL_DAYS;

  beforeEach(() => {
    delete process.env.PREDICTION_CACHE_TTL_DAYS;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.PREDICTION_CACHE_TTL_DAYS;
    else process.env.PREDICTION_CACHE_TTL_DAYS = original;
  });

  it("defaults to 7 days", () => {
    expect(getPredictionCacheTtlMs()).toBe(7 * 86_400_000);
  });

  it("respects PREDICTION_CACHE_TTL_DAYS", () => {
    process.env.PREDICTION_CACHE_TTL_DAYS = "3";
    expect(getPredictionCacheTtlMs()).toBe(3 * 86_400_000);
  });

  it("expires predictions older than TTL", () => {
    const now = Date.parse("2026-06-10T00:00:00.000Z");
    const generatedAt = "2026-06-01T00:00:00.000Z";
    expect(isPredictionExpired(generatedAt, now)).toBe(true);
  });

  it("keeps fresh predictions", () => {
    const now = Date.parse("2026-06-10T00:00:00.000Z");
    const generatedAt = "2026-06-09T12:00:00.000Z";
    expect(isPredictionExpired(generatedAt, now)).toBe(false);
  });
});
