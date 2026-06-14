import type { Match, Team } from "@/lib/types";
import { formatBracketSlot } from "@/lib/utils/slots";
import { formatLocalDate } from "@/lib/utils/dates";

const STAGE_LABELS: Record<string, string> = {
  group: "Group stage",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  third_place: "Third place",
  final: "Final",
};

export function formatStageLabel(stage: string, group?: string): string {
  if (stage === "group" && group) return `Group ${group}`;
  return STAGE_LABELS[stage] ?? stage;
}

export function formatTeamSide(
  teamId: string | "TBD",
  slot: string | undefined,
  teamMap: Map<string, Team>,
): string {
  if (teamId !== "TBD") return teamMap.get(teamId)?.name ?? teamId.toUpperCase();
  if (slot) return formatBracketSlot(slot);
  return "TBD";
}

export function formatMatchTeams(match: Match, teamMap: Map<string, Team>): string {
  const home = formatTeamSide(match.homeTeamId, match.homeSlot, teamMap);
  const away = formatTeamSide(match.awayTeamId, match.awaySlot, teamMap);
  return `${home} vs ${away}`;
}

export function formatMatchLabel(match: Match, teamMap: Map<string, Team>): string {
  const teams = formatMatchTeams(match, teamMap);
  const stage = formatStageLabel(match.stage, match.group);
  return `${teams} · ${stage}`;
}

export function formatMatchPickerLabel(match: Match, teamMap: Map<string, Team>): string {
  const teams = formatMatchTeams(match, teamMap);
  const stage = formatStageLabel(match.stage, match.group);
  const date = formatLocalDate(match.date);
  return `${teams} (${stage}, ${date})`;
}
