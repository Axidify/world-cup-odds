import type { OfficialBracketMatch } from "@/lib/bracket/official-knockout";
import type { KnockoutPathMatch, Match, PlayedMatchResult, Team } from "@/lib/types";
import { formatBracketSlot } from "@/lib/utils/slots";

export type BracketTeamLine = {
  teamId: string;
  name: string;
  flagCode: string;
};

export type BracketMatchDisplay = {
  matchId: string;
  stage: Match["stage"];
  date: string;
  home: BracketTeamLine | null;
  away: BracketTeamLine | null;
  slotLabel: string | null;
  winnerId?: string;
  score: { home: number; away: number } | null;
  projected: boolean;
};

type BracketSlot = { home: string; away: string };

function teamLine(teamMap: Map<string, Team>, teamId: string): BracketTeamLine | null {
  const t = teamMap.get(teamId);
  if (!t || teamId === "TBD") return null;
  return { teamId: t.id, name: t.name, flagCode: t.flagCode };
}

function slotLabel(
  match: Match,
  bracketSlots: Map<string, BracketSlot>,
): string {
  const slot = bracketSlots.get(match.id);
  if (slot) return `${slot.home} vs ${slot.away}`;
  if (match.homeSlot && match.awaySlot) {
    return `${formatBracketSlot(match.homeSlot)} vs ${formatBracketSlot(match.awaySlot)}`;
  }
  return "TBD vs TBD";
}

export function buildBracketMatchDisplay(
  match: Match,
  options: {
    pathEntry?: OfficialBracketMatch | KnockoutPathMatch | null;
    confirmed?: PlayedMatchResult | null;
    bracketSlots: Map<string, BracketSlot>;
    teamMap: Map<string, Team>;
    isProjected: boolean;
  },
): BracketMatchDisplay {
  const { pathEntry, confirmed, bracketSlots, teamMap, isProjected } = options;
  const homeId = pathEntry?.homeTeamId;
  const awayId = pathEntry?.awayTeamId;
  const home = homeId ? teamLine(teamMap, homeId) : null;
  const away = awayId ? teamLine(teamMap, awayId) : null;
  const winnerId =
    pathEntry && "winnerTeamId" in pathEntry ? pathEntry.winnerTeamId : undefined;

  const score =
    confirmed && confirmed.homeGoals != null && confirmed.awayGoals != null
      ? { home: confirmed.homeGoals, away: confirmed.awayGoals }
      : null;

  const showWinner = isProjected ? Boolean(winnerId) : Boolean(score && winnerId);

  return {
    matchId: match.id,
    stage: match.stage,
    date: match.date,
    home,
    away,
    slotLabel: home && away ? null : slotLabel(match, bracketSlots),
    winnerId: showWinner ? winnerId : undefined,
    score,
    projected: isProjected && !score && Boolean(home && away),
  };
}
