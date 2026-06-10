import thirdPlaceCombos from "@/data/third-place-combos.json";
import type { BracketTemplate, GroupStanding, Match } from "@/lib/types";

export type ThirdPlaceMapping = Record<"1A" | "1B" | "1D" | "1E" | "1G" | "1I" | "1K" | "1L", string>;

export function thirdPlaceCombinationKey(groups: string[]): string {
  return [...groups].sort().join("");
}

export function getThirdPlaceMapping(qualifyingGroups: string[]): ThirdPlaceMapping {
  const key = thirdPlaceCombinationKey(qualifyingGroups);
  const mapping = (thirdPlaceCombos as Record<string, ThirdPlaceMapping>)[key];
  if (!mapping) {
    throw new Error(`Unknown third-place combination: ${key}`);
  }
  return mapping;
}

export function resolveGroupSlot(
  slot: string,
  standingsByGroup: Record<string, GroupStanding[]>,
): string {
  const pos = Number(slot[0]);
  const group = slot[1];
  const row = standingsByGroup[group]?.[pos - 1];
  if (!row) throw new Error(`Cannot resolve slot ${slot}`);
  return row.teamId;
}

export function resolveThirdPlaceSlot(
  thirdSlot: string,
  partnerWinnerSlot: string,
  mapping: ThirdPlaceMapping,
  thirdByGroup: Record<string, GroupStanding>,
): string {
  if (!partnerWinnerSlot.startsWith("1") || partnerWinnerSlot.length !== 2) {
    throw new Error(`Invalid partner winner slot for third place: ${partnerWinnerSlot}`);
  }
  const mapped = mapping[partnerWinnerSlot as keyof ThirdPlaceMapping];
  if (!mapped) throw new Error(`No third-place mapping for ${partnerWinnerSlot}`);
  const group = mapped.slice(1);
  const row = thirdByGroup[group];
  if (!row) throw new Error(`Third-place team missing for group ${group}`);
  return row.teamId;
}

function partnerWinnerSlot(home: string, away: string): string | null {
  if (home.startsWith("1") && home.length === 2 && away.startsWith("3")) return home;
  if (away.startsWith("1") && away.length === 2 && home.startsWith("3")) return away;
  return null;
}

export function resolveR32Slot(
  slot: string,
  homePartner: string,
  awayPartner: string,
  standingsByGroup: Record<string, GroupStanding[]>,
  thirdMapping: ThirdPlaceMapping,
  thirdByGroup: Record<string, GroupStanding>,
): string {
  if (slot.startsWith("1") || slot.startsWith("2")) {
    return resolveGroupSlot(slot, standingsByGroup);
  }
  if (slot.startsWith("3")) {
    const winner = partnerWinnerSlot(homePartner, awayPartner);
    if (!winner) throw new Error(`Cannot find winner partner for third slot ${slot}`);
    return resolveThirdPlaceSlot(slot, winner, thirdMapping, thirdByGroup);
  }
  throw new Error(`Unknown R32 slot: ${slot}`);
}

export function buildR32Pairings(
  template: BracketTemplate,
  standingsByGroup: Record<string, GroupStanding[]>,
  qualifiedThirdGroups: string[],
  thirdByGroup: Record<string, GroupStanding>,
): Array<{ matchId: string; homeTeamId: string; awayTeamId: string }> {
  const mapping = getThirdPlaceMapping(qualifiedThirdGroups);
  return template.r32.map((slot) => ({
    matchId: slot.matchId,
    homeTeamId: resolveR32Slot(
      slot.home,
      slot.home,
      slot.away,
      standingsByGroup,
      mapping,
      thirdByGroup,
    ),
    awayTeamId: resolveR32Slot(
      slot.away,
      slot.home,
      slot.away,
      standingsByGroup,
      mapping,
      thirdByGroup,
    ),
  }));
}

export function resolveKnockoutTeams(
  match: Match,
  winners: Map<string, string>,
  losers: Map<string, string>,
): { homeTeamId: string; awayTeamId: string } {
  const homeSlot = match.homeSlot;
  const awaySlot = match.awaySlot;
  if (!homeSlot || !awaySlot) {
    throw new Error(`Knockout match ${match.id} missing slot refs`);
  }
  return {
    homeTeamId: resolveProgressionSlot(homeSlot, winners, losers),
    awayTeamId: resolveProgressionSlot(awaySlot, winners, losers),
  };
}

function resolveProgressionSlot(
  slot: string,
  winners: Map<string, string>,
  losers: Map<string, string>,
): string {
  if (slot.startsWith("W:")) {
    const id = winners.get(slot.slice(2));
    if (!id) throw new Error(`Winner not set for ${slot}`);
    return id;
  }
  if (slot.startsWith("L:")) {
    const id = losers.get(slot.slice(2));
    if (!id) throw new Error(`Loser not set for ${slot}`);
    return id;
  }
  throw new Error(`Unknown progression slot: ${slot}`);
}

export function collectQualifiedThirdGroups(thirdPlace: GroupStanding[]): string[] {
  return thirdPlace.slice(0, 8).map((t) => t.group);
}
