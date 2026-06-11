import { describe, expect, it } from "vitest";
import { normalizeExtractedResult, tryParseScoreFromSnippets } from "@/lib/ai/extract-result";

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

describe("tryParseScoreFromSnippets", () => {
  const match = {
    id: "grp-a-1",
    stage: "group" as const,
    group: "A",
    homeTeamId: "mex",
    awayTeamId: "rsa",
    date: "2026-06-11T19:00:00.000Z",
    venue: "Estadio Azteca",
  };

  it("parses score when snippet mentions both teams", () => {
    const score = tryParseScoreFromSnippets(match, [
      {
        title: "Mexico beat South Africa 2-0 in World Cup opener",
        url: "https://example.com",
        content: "Full time: Mexico 2-0 South Africa at the Azteca.",
      },
    ]);
    expect(score).toEqual({ homeScore: 2, awayScore: 0 });
  });
});
