import { describe, it, expect } from "vitest";
import { buildConsensusKnockoutPath, contextFromModalStandings } from "@/lib/bracket/consensus-path";
import { createSyntheticPredictionStore } from "@/lib/sim/prediction-store";
import { runModalTournament } from "@/lib/simulator";

describe("consensus bracket path", () => {
  const store = createSyntheticPredictionStore("vllm");

  it("builds tournament context from modal standings", () => {
    const { groupStandings } = runModalTournament(store);
    const ctx = contextFromModalStandings(groupStandings);
    expect(Object.keys(ctx.standingsByGroup).length).toBe(12);
    expect(ctx.qualifiedThirdGroups.length).toBe(8);
  });

  it("produces a full knockout path and champion", () => {
    const { groupStandings } = runModalTournament(store);
    const { knockout, championTeamId } = buildConsensusKnockoutPath(store, groupStandings);
    expect(knockout.length).toBe(32);
    expect(championTeamId).toBeTruthy();
    expect(knockout.find((m) => m.stage === "final")?.winnerTeamId).toBe(championTeamId);
  });
});
