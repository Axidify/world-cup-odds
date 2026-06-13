import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { buildCacheKey } from "@/lib/ai/cache-key";
import { savePrediction } from "@/lib/ai/predictions";
import { setActiveProvider } from "@/lib/ai/settings";
import { seedPairingFromElo } from "@/lib/calibration/seed-elo-predictions";
import {
  applyAdminConfirmedResult,
  clearStaleForFixture,
  finalizeResultUnconfirmation,
  markTeamsStale,
} from "@/lib/results/on-confirm";
import { getEloRating, recomputeEloFromConfirmedResults } from "@/lib/calibration/elo";
import { getFixtures } from "@/lib/data/load";
import { buildGroupFixtureProbs } from "@/lib/match/group-fixture-probs";
import { getDb } from "@/lib/db";
import {
  appSettings,
  actualResults,
  calibrationState,
  eloRatings,
  predictionLog,
  predictions,
} from "@/lib/db/schema";
import { loadPredictionStore } from "@/lib/sim/prediction-store";
import { resolveFixtureProbabilities } from "@/lib/predictions/resolve-fixture-probs";
import { buildStaleAnalyzeQueue } from "@/lib/ai/preanalyze";
import type { LLMProvider } from "@/lib/types";

describe("phase 0 prediction integrity", () => {
  beforeEach(() => {
    process.env.LLM_PROVIDER = "vllm";
    process.env.VLLM_BASE_URL = "http://127.0.0.1:8001/v1";
    process.env.VLLM_MODEL = "test-model";
    delete process.env.PREDICTION_CACHE_TTL_DAYS;

    const db = getDb();
    db.delete(predictions).run();
    db.delete(actualResults).run();
    db.delete(predictionLog).run();
    db.delete(appSettings).run();
    db.delete(eloRatings).run();
    db.delete(calibrationState).run();
    recomputeEloFromConfirmedResults();
    setActiveProvider("vllm");
  });

  afterEach(() => {
    delete process.env.PREDICTION_CACHE_TTL_DAYS;
  });

  function seedLlm(
    homeTeamId: string,
    awayTeamId: string,
    stage: string,
    overrides: Partial<{ stale: number; generatedAt: string }> = {},
  ) {
    savePrediction({
      homeTeamId,
      awayTeamId,
      stage,
      provider: "vllm",
      model: "test-model",
      homeWinPct: 55,
      drawPct: 25,
      awayWinPct: 20,
      predictedScore: "2-1",
      keyFactors: ["form"],
      analysis: "LLM analysis",
      source: "llm",
    });
    const cacheKey = buildCacheKey(homeTeamId, awayTeamId, stage, "vllm", "test-model");
    if (overrides.stale != null || overrides.generatedAt) {
      getDb()
        .update(predictions)
        .set({
          ...(overrides.stale != null ? { stale: overrides.stale } : {}),
          ...(overrides.generatedAt ? { generatedAt: overrides.generatedAt } : {}),
        })
        .where(eq(predictions.cacheKey, cacheKey))
        .run();
    }
    return cacheKey;
  }

  it("does not Elo-overwrite stale LLM rows when allowOverwrite is false", () => {
    seedLlm("pan", "crc", "group", { stale: 1 });
    const cacheKey = buildCacheKey("pan", "crc", "group", "vllm", "test-model");
    const before = getDb().select().from(predictions).where(eq(predictions.cacheKey, cacheKey)).get();

    const seeded = seedPairingFromElo("pan", "crc", "group", "vllm", "test-model", undefined, {
      allowOverwrite: false,
    });
    expect(seeded).toBe(false);

    const after = getDb().select().from(predictions).where(eq(predictions.cacheKey, cacheKey)).get();
    expect(after?.analysis).toBe(before?.analysis);
    expect(after?.stale).toBe(1);
    expect(after?.source).toBe("llm");
  });

  it("uses stale LLM predictions in the simulation store", () => {
    seedLlm("bra", "mex", "group", { stale: 1 });
    const store = loadPredictionStore("vllm");
    const pred = store.get("bra", "mex", "group");
    expect(pred.analysis).toBe("LLM analysis");
  });

  it("resolveFixtureProbabilities matches match page tier for stale rows", () => {
    seedLlm("bra", "mex", "group", { stale: 1 });
    const resolved = resolveFixtureProbabilities("bra", "mex", "group");
    expect(resolved?.tier).toBe("stale");
    expect(resolved?.prediction.analysis).toBe("LLM analysis");
  });

  it("buildStaleAnalyzeQueue lists stale DB rows", () => {
    seedLlm("bra", "mex", "group");
    seedLlm("bra", "arg", "group");
    markTeamsStale("bra", "mex");

    const queue = buildStaleAnalyzeQueue();
    const keys = queue.map((q) =>
      q.kind === "match" ? q.matchId : `${q.homeTeamId}|${q.awayTeamId}|${q.stage}`,
    );
    expect(keys.some((k) => k.includes("bra") && k.includes("mex"))).toBe(true);
    expect(keys.some((k) => k.includes("bra") && k.includes("arg"))).toBe(true);
  });

  it("buildStaleAnalyzeQueue includes TTL-expired LLM rows", () => {
    seedLlm("bra", "mar", "group", {
      generatedAt: "2020-01-01T00:00:00.000Z",
    });
    const queue = buildStaleAnalyzeQueue();
    expect(
      queue.some(
        (q) =>
          (q.kind === "match" && q.matchId === "grp-c-1") ||
          (q.kind === "pair" &&
            ((q.homeTeamId === "bra" && q.awayTeamId === "mar") ||
              (q.homeTeamId === "mar" && q.awayTeamId === "bra"))),
      ),
    ).toBe(true);
  });

  it("does not Elo-overwrite expired LLM rows", () => {
    seedLlm("bra", "mex", "group", {
      generatedAt: "2020-01-01T00:00:00.000Z",
    });
    const seeded = seedPairingFromElo("bra", "mex", "group", "vllm" as LLMProvider, "test-model", undefined, {
      allowOverwrite: false,
    });
    expect(seeded).toBe(false);
  });

  it("groups fixture probs match resolveFixtureProbabilities for the same match", () => {
    const fixture = getFixtures().find((m) => m.homeTeamId === "mex" && m.awayTeamId === "rsa");
    expect(fixture).toBeDefined();
    seedLlm(fixture!.homeTeamId, fixture!.awayTeamId, "group", { stale: 1 });

    const resolved = resolveFixtureProbabilities(fixture!.homeTeamId, fixture!.awayTeamId, "group", {
      kickoffIso: fixture!.date,
    });
    const groupProbs = buildGroupFixtureProbs()[fixture!.id];
    expect(groupProbs).toBeDefined();
    expect(groupProbs!.home).toBe(Math.round(resolved!.homeWinPct));
    expect(groupProbs!.draw).toBe(Math.round(resolved!.drawPct));
    expect(groupProbs!.away).toBe(Math.round(resolved!.awayWinPct));
  });

  it("buildStaleAnalyzeQueue skips confirmed group fixtures", () => {
    const fixture = getFixtures().find((m) => m.homeTeamId === "mex" && m.awayTeamId === "rsa");
    expect(fixture).toBeDefined();

    seedLlm(fixture!.homeTeamId, fixture!.awayTeamId, "group", { stale: 1 });
    applyAdminConfirmedResult({
      matchId: fixture!.id,
      homeScore: 2,
      awayScore: 1,
    });
    markTeamsStale(fixture!.homeTeamId, fixture!.awayTeamId);

    const queue = buildStaleAnalyzeQueue();
    const hit = queue.find((q) => q.kind === "match" && q.matchId === fixture!.id);
    expect(hit).toBeUndefined();
  });

  it("unconfirm clears stale for the fixture and replays Elo", () => {
    const fixture = getFixtures().find((m) => m.homeTeamId === "mex" && m.awayTeamId === "rsa");
    expect(fixture).toBeDefined();

    seedLlm(fixture!.homeTeamId, fixture!.awayTeamId, "group");
    const eloBefore = getEloRating("mex");

    applyAdminConfirmedResult({
      matchId: fixture!.id,
      homeScore: 2,
      awayScore: 0,
    });
    const eloAfterWin = getEloRating("mex");
    expect(eloAfterWin).not.toBe(eloBefore);

    const cacheKey = buildCacheKey(
      fixture!.homeTeamId,
      fixture!.awayTeamId,
      "group",
      "vllm",
      "test-model",
    );
    expect(getDb().select().from(predictions).where(eq(predictions.cacheKey, cacheKey)).get()?.stale).toBe(1);

    expect(finalizeResultUnconfirmation(fixture!.id)).toBe(true);
    expect(getDb().select().from(predictions).where(eq(predictions.cacheKey, cacheKey)).get()?.stale).toBe(0);
    expect(getEloRating("mex")).toBe(eloBefore);
  });

  it("clearStaleForFixture only clears the pairing row", () => {
    seedLlm("bra", "mex", "group", { stale: 1 });
    seedLlm("bra", "arg", "group", { stale: 1 });

    clearStaleForFixture("bra", "mex", "group");

    const mexKey = buildCacheKey("bra", "mex", "group", "vllm", "test-model");
    const argKey = buildCacheKey("bra", "arg", "group", "vllm", "test-model");
    expect(getDb().select().from(predictions).where(eq(predictions.cacheKey, mexKey)).get()?.stale).toBe(0);
    expect(getDb().select().from(predictions).where(eq(predictions.cacheKey, argKey)).get()?.stale).toBe(1);
  });
});
