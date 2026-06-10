import { describe, it, expect } from "vitest";
import { buildLearningContext } from "@/lib/ai/build-context";
import { getTeam } from "@/lib/data/load";

describe("buildLearningContext", () => {
  it("includes Elo ratings for both teams", () => {
    const home = getTeam("mex")!;
    const away = getTeam("rsa")!;
    const ctx = buildLearningContext(home, away);
    expect(ctx).toContain("LEARNING CONTEXT:");
    expect(ctx).toContain("Mexico Elo:");
    expect(ctx).toContain("South Africa Elo:");
  });

  it("includes team news section", () => {
    const home = getTeam("bra")!;
    const away = getTeam("mar")!;
    const ctx = buildLearningContext(home, away);
    expect(ctx).toContain("Team news:");
  });
});
