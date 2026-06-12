import type { FootballDataTeamRef } from "@/lib/results/football-data/team-tla";

export type FootballDataMatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "LIVE"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED"
  | string;

export type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: FootballDataMatchStatus;
  homeTeam: FootballDataTeamRef;
  awayTeam: FootballDataTeamRef;
  score?: {
    winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration?: string | null;
    fullTime?: Record<string, number | null> | null;
    extraTime?: Record<string, number | null> | null;
    penalties?: Record<string, number | null> | null;
  } | null;
};

export type ParsedFootballDataResult = {
  apiMatchId: number;
  homeScore: number;
  awayScore: number;
  et: boolean;
  pens: boolean;
  winnerTeamId: string | null;
  source: string;
};
