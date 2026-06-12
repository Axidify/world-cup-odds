import { describe, it, expect } from "vitest";
import { buildLearningContext } from "@/lib/ai/build-context";
import { getTeam } from "@/lib/data/load";

describe("buildLearningContext", () => {
  it("includes learning context header", () => {
    const home = getTeam("mex")!;
    const away = getTeam("rsa")!;
    const ctx = buildLearningContext(home, away);
    expect(ctx).toContain("LEARNING CONTEXT:");
  });

  it("excludes squad news — applied via deterministic overlay instead", () => {
    const home = getTeam("bra")!;
    const away = getTeam("mar")!;
    const ctx = buildLearningContext(home, away);
    expect(ctx).not.toContain("Team news:");
    expect(ctx).not.toContain("squad news");
  });
});
