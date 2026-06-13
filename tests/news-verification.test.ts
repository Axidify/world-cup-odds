import { describe, it, expect } from "vitest";
import { buildLearningContext } from "@/lib/ai/build-context";
import { buildKnockoutPairPrompt, buildMatchUserPrompt } from "@/lib/ai/prompts";
import { toMatchView } from "@/lib/ai/predictions";
import { getTeam } from "@/lib/data/load";
import { getResolvedMatches } from "@/lib/data/resolved";
import {
  applyNewsImpactToStoredPrediction,
  applyNewsImpactToView,
  fixtureProbabilitiesWithNews,
} from "@/lib/news/impact";
import type { Prediction } from "@/lib/types";

describe("news fix verification", () => {
  it("prompts exclude squad news from LLM context", () => {
    const home = getTeam("bra")!;
    const away = getTeam("arg")!;
    const ctx = buildLearningContext(home, away);
    expect(ctx).not.toContain("Team news:");
    expect(ctx).not.toContain("squad news on file");

    const match = getResolvedMatches().find(
      (m) => m.homeTeamId !== "TBD" && m.awayTeamId !== "TBD",
    );
    expect(match).toBeDefined();
    const h = getTeam(match!.homeTeamId)!;
    const a = getTeam(match!.awayTeamId)!;
    expect(buildMatchUserPrompt(match!, h, a)).not.toContain("Team news:");
    expect(buildKnockoutPairPrompt(home, away, "r16")).not.toContain("Team news:");
  });

  it("view overlay matches fixtureProbabilitiesWithNews for fixture home", () => {
    const pred: Prediction = {
      cacheKey: "t",
      teamA: "bra",
      teamB: "arg",
      stage: "group",
      isNeutral: 1,
      provider: "vllm",
      model: "t",
      homeWinPct: 55,
      drawPct: 25,
      awayWinPct: 20,
      predictedScore: "2-1",
      keyFactors: [],
      analysis: null,
      isCalibrated: 0,
      stale: 0,
      generatedAt: "2026-06-01T00:00:00.000Z",
    };
    const homeId = "bra";
    const awayId = "arg";
    const view = applyNewsImpactToView(toMatchView(pred, homeId, awayId, true), homeId, awayId);
    const fromStore = fixtureProbabilitiesWithNews(pred, homeId, awayId);
    expect(view.homeWinPct).toBeCloseTo(fromStore.home * 100, 5);
    expect(view.drawPct).toBeCloseTo(fromStore.draw * 100, 5);
    expect(view.awayWinPct).toBeCloseTo(fromStore.away * 100, 5);
  });

  it("simulation store overlay matches fixture-oriented overlay when home is teamB", () => {
    const pred: Prediction = {
      cacheKey: "t",
      teamA: "arg",
      teamB: "bra",
      stage: "group",
      isNeutral: 1,
      provider: "vllm",
      model: "t",
      homeWinPct: 20,
      drawPct: 25,
      awayWinPct: 55,
      predictedScore: "1-2",
      keyFactors: [],
      analysis: null,
      isCalibrated: 0,
      stale: 0,
      generatedAt: "2026-06-01T00:00:00.000Z",
    };
    const adjusted = applyNewsImpactToStoredPrediction(pred);
    const fixture = fixtureProbabilitiesWithNews(pred, "bra", "arg");
    const homeIsTeamA = pred.teamA === "bra";
    const storeHome = homeIsTeamA ? adjusted.homeWinPct : adjusted.awayWinPct;
    const storeAway = homeIsTeamA ? adjusted.awayWinPct : adjusted.homeWinPct;
    expect(storeHome).toBeCloseTo(fixture.home * 100, 5);
    expect(storeAway).toBeCloseTo(fixture.away * 100, 5);
  });

  it("analyze-match and analyze-pair delegate to shared analyze-pairing core", async () => {
    const fs = await import("fs/promises");
    const matchSrc = await fs.readFile("lib/ai/analyze-match.ts", "utf8");
    const pairSrc = await fs.readFile("lib/ai/analyze-pair.ts", "utf8");
    const coreSrc = await fs.readFile("lib/ai/analyze-pairing.ts", "utf8");

    expect(matchSrc).toContain("analyzePairing(");
    expect(pairSrc).toContain("analyzePairing(");
    expect(coreSrc).toContain(
      "applyNewsImpactToView(toMatchView(cached, home.id, away.id, true), home.id, away.id)",
    );
    expect(coreSrc).toContain("toMatchView(saved, home.id, away.id, false)");
    expect(coreSrc).toContain("applyNewsImpactToView(");
  });
});
