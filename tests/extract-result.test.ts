import { describe, expect, it } from "vitest";
import { normalizeExtractedResult } from "@/lib/ai/extract-result";

describe("normalizeExtractedResult", () => {
  it("reads flat homeScore/awayScore", () => {
    expect(normalizeExtractedResult({ homeScore: 2, awayScore: 1 })).toMatchObject({
      homeScore: 2,
      awayScore: 1,
    });
  });

  it("reads nested score.home / score.away from Gemini", () => {
    expect(
      normalizeExtractedResult({
        match_id: "grp-a-1",
        score: { home: 3, away: 0 },
      }),
    ).toMatchObject({ homeScore: 3, awayScore: 0 });
  });

  it("reads nested result.home_score", () => {
    expect(
      normalizeExtractedResult({
        result: { home_score: 1, away_score: 1 },
      }),
    ).toMatchObject({ homeScore: 1, awayScore: 1 });
  });

  it("maps null scores to -1", () => {
    expect(normalizeExtractedResult({ home_score: null, away_score: null })).toMatchObject({
      homeScore: -1,
      awayScore: -1,
    });
  });
});
