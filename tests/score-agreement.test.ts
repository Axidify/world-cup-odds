import { describe, it, expect } from "vitest";
import { parseScoreFromText, scoresMatch, snippetsAgreeOnScore } from "@/lib/results/score-agreement";

describe("score agreement", () => {
  it("parses common score patterns", () => {
    expect(parseScoreFromText("Mexico won 2-1 in regulation")).toEqual({ homeScore: 2, awayScore: 1 });
    expect(parseScoreFromText("Final: 0-0 draw")).toEqual({ homeScore: 0, awayScore: 0 });
  });

  it("matches identical scores", () => {
    expect(scoresMatch({ homeScore: 2, awayScore: 1 }, { homeScore: 2, awayScore: 1 })).toBe(true);
    expect(scoresMatch({ homeScore: 2, awayScore: 1 }, { homeScore: 1, awayScore: 2 })).toBe(false);
  });

  it("requires 2+ snippet agreements", () => {
    const snippets = [
      { title: "A", url: "a", content: "Mexico beat South Africa 2-1" },
      { title: "B", url: "b", content: "Final score 2-1 to Mexico" },
      { title: "C", url: "c", content: "Unrelated text" },
    ];
    expect(snippetsAgreeOnScore(snippets, { homeScore: 2, awayScore: 1 })).toBe(true);
    expect(snippetsAgreeOnScore(snippets, { homeScore: 3, awayScore: 0 })).toBe(false);
  });
});
