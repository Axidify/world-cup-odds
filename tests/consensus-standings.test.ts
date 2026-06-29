import { describe, it, expect } from "vitest";
import { buildConsensusKnockoutPath } from "@/lib/bracket/consensus-path";
import {
  areAllGroupFixturesConfirmed,
  resolveConsensusGroupStandings,
} from "@/lib/bracket/consensus-standings";
import { buildOfficialKnockoutPath } from "@/lib/bracket/official-knockout";
import { buildOfficialStandingsByGroup } from "@/lib/standings/official-standings";
import { createSyntheticPredictionStore } from "@/lib/sim/prediction-store";
import { runModalTournament } from "@/lib/simulator";
import type { PlayedMatchResult } from "@/lib/types";

function groupResultsToConfirmed(
  groupResults: PlayedMatchResult[],
): Map<string, PlayedMatchResult> {
  return new Map(groupResults.map((r) => [r.matchId, r]));
}

describe("consensus group standings", () => {
  const store = createSyntheticPredictionStore("vllm");

  it("detects incomplete group stage", () => {
    expect(areAllGroupFixturesConfirmed(new Map())).toBe(false);
  });

  it("uses modal standings while the group stage is in progress", () => {
    const { groupStandings, groupResults } = runModalTournament(store);
    const partial = new Map(groupResults.slice(0, 10).map((r) => [r.matchId, r]));
    expect(areAllGroupFixturesConfirmed(partial)).toBe(false);
    expect(resolveConsensusGroupStandings(partial, groupStandings)).toBe(groupStandings);
  });

  it("uses official standings once every group match is confirmed", () => {
    const { groupStandings, groupResults } = runModalTournament(store);
    const confirmed = groupResultsToConfirmed(groupResults);
    expect(areAllGroupFixturesConfirmed(confirmed)).toBe(true);

    const resolved = resolveConsensusGroupStandings(confirmed, groupStandings);
    const official = buildOfficialStandingsByGroup(confirmed);
    expect(resolved).toEqual(official);
  });

  it("matches official R32 pairings when the group stage is complete", () => {
    const { groupResults } = runModalTournament(store);
    const confirmed = groupResultsToConfirmed(groupResults);
    const standings = resolveConsensusGroupStandings(confirmed, undefined)!;

    const officialR32 = buildOfficialKnockoutPath(confirmed).knockout.filter((m) => m.stage === "r32");
    const consensusR32 = buildConsensusKnockoutPath(store, standings, confirmed).knockout.filter(
      (m) => m.stage === "r32",
    );

    expect(consensusR32.length).toBe(officialR32.length);
    for (const officialMatch of officialR32) {
      const consensusMatch = consensusR32.find((m) => m.matchId === officialMatch.matchId);
      expect(consensusMatch).toBeDefined();
      expect(consensusMatch!.homeTeamId).toBe(officialMatch.homeTeamId);
      expect(consensusMatch!.awayTeamId).toBe(officialMatch.awayTeamId);
    }
  });
});
