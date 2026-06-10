import { describe, it, expect } from "vitest";
import {
  extractJsonObject,
  normalizePercentages,
  parseMatchPrediction,
} from "@/lib/ai/parse-response";

describe("parse-response", () => {
  it("extracts JSON from markdown fences", () => {
    const raw = 'Here is the result:\n```json\n{"homeWinPct":40,"drawPct":30,"awayWinPct":30,"predictedScore":"1-1","keyFactors":["a"],"analysis":"ok"}\n```';
    const json = extractJsonObject(raw);
    expect(json.startsWith("{")).toBe(true);
  });

  it("normalizes percentages to sum to 100", () => {
    const [h, d, a] = normalizePercentages(50, 30, 10);
    expect(Math.round(h + d + a)).toBe(100);
  });

  it("parses valid prediction JSON", () => {
    const raw = JSON.stringify({
      homeWinPct: 45,
      drawPct: 28,
      awayWinPct: 27,
      predictedScore: "2-1",
      keyFactors: ["Form", "Ranking"],
      analysis: "Close match expected.",
    });
    const p = parseMatchPrediction(raw);
    expect(p.homeWinPct + p.drawPct + p.awayWinPct).toBeCloseTo(100, 0);
    expect(p.predictedScore).toBe("2-1");
    expect(p.keyFactors).toHaveLength(2);
  });
});
