export type BigBallsTeamRef = {
  id?: string;
  team_id?: string;
  name?: string;
  team_name?: string;
  short_name?: string;
  abbr?: string;
};

export type BigBallsMatch = {
  id: string;
  kickoff_utc?: string;
  kickoff?: string;
  start_time?: string;
  status?: string;
  minute?: number | string | null;
  period?: string | null;
  home?: BigBallsTeamRef | string | null;
  away?: BigBallsTeamRef | string | null;
  home_team?: BigBallsTeamRef | string | null;
  away_team?: BigBallsTeamRef | string | null;
  score?: {
    home?: number | null;
    away?: number | null;
    penalties?: { home?: number | null; away?: number | null } | null;
    extra_time?: { home?: number | null; away?: number | null } | null;
  } | null;
  scores?: {
    value?: { home?: number | null; away?: number | null };
  } | null;
  went_to_extra_time?: boolean;
  went_to_penalties?: boolean;
  winner?: "home" | "away" | "HOME" | "AWAY" | string | null;
  winner_team_id?: string | null;
};

export type BigBallsMatchesResponse = {
  data?: BigBallsMatch[] | Record<string, unknown>;
  matches?: BigBallsMatch[];
  error?: { message?: string; code?: string };
};

export type BigBallsStatus = {
  ok: boolean;
  matchCount: number;
  finishedCount: number;
  error?: string;
};
