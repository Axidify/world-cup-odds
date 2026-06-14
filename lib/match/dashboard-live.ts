import { getTeam } from "@/lib/data/load";
import { listMatchesInLiveWindow } from "@/lib/match/live-window";
import type { Match } from "@/lib/types";

export type DashboardLiveMatchView = {
  matchId: string;
  kickoffIso: string;
  homeName: string;
  awayName: string;
  homeFlagCode: string;
  awayFlagCode: string;
  group?: string | null;
  stage: string;
};

export function getDashboardLiveMatches(now = Date.now()): DashboardLiveMatchView[] {
  return listMatchesInLiveWindow(now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((match) => toDashboardLiveMatchView(match));
}

function toDashboardLiveMatchView(match: Match): DashboardLiveMatchView[] {
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (!home || !away) return [];

  return [
    {
      matchId: match.id,
      kickoffIso: match.date,
      homeName: home.name,
      awayName: away.name,
      homeFlagCode: home.flagCode,
      awayFlagCode: away.flagCode,
      group: match.group,
      stage: match.stage,
    },
  ];
}
