import { getFixtures } from "@/lib/data/load";
import { buildOfficialStandingsByGroup } from "@/lib/standings/official-standings";
import type { GroupStanding, PlayedMatchResult } from "@/lib/types";

/** True when every group-stage fixture has a confirmed result. */
export function areAllGroupFixturesConfirmed(
  confirmed: Map<string, PlayedMatchResult>,
): boolean {
  return getFixtures().every((f) => confirmed.has(f.id));
}

/**
 * Group tables for the consensus bracket.
 * After the group stage is complete, use official standings so R32 pairings match Official.
 * While the group stage is in progress, fall back to modal standings from the last simulation.
 */
export function resolveConsensusGroupStandings(
  confirmed: Map<string, PlayedMatchResult>,
  modalStandings: Record<string, GroupStanding[]> | undefined,
): Record<string, GroupStanding[]> | null {
  if (areAllGroupFixturesConfirmed(confirmed)) {
    return buildOfficialStandingsByGroup(confirmed);
  }
  return modalStandings ?? null;
}

/** Whether consensus R32 seeding uses the same tables as the Official tab. */
export function isConsensusSeededFromOfficial(
  confirmed: Map<string, PlayedMatchResult>,
): boolean {
  return areAllGroupFixturesConfirmed(confirmed);
}
