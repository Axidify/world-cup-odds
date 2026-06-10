export type Confederation = "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";

export type Team = {
  id: string;
  name: string;
  flagCode: string;
  fifaRank: number;
  confederation: Confederation;
};

export type MatchStage =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "final"
  | "third_place";

export type Match = {
  id: string;
  stage: MatchStage;
  group?: string;
  homeTeamId: string | "TBD";
  awayTeamId: string | "TBD";
  homeSlot?: string;
  awaySlot?: string;
  date: string;
  venue: string;
  knockoutRound?: number;
};

export type GroupAssignment = {
  group: string;
  teamIds: [string, string, string, string];
};

export type BracketSlot = {
  matchId: string;
  home: string;
  away: string;
};

export type BracketTemplate = {
  r32: BracketSlot[];
  thirdPlaceCombos: string;
  advancement: {
    groupTop2: boolean;
    bestThirdCount: number;
  };
};

export type LLMProvider = "vllm" | "openai" | "openrouter" | "gemini" | "anthropic";

export type Prediction = {
  cacheKey: string;
  teamA: string;
  teamB: string;
  stage: string;
  isNeutral: number;
  provider: string;
  model: string;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  predictedScore: string | null;
  keyFactors: string[];
  analysis: string | null;
  isCalibrated: number;
  stale: number;
  generatedAt: string;
};

export type GroupStanding = {
  teamId: string;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;
};

export type PlayedMatchResult = {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
  /** Set for confirmed knockout results — advance winner (incl. ET/pens). */
  winnerTeamId?: string;
};

export type KnockoutPathMatch = {
  matchId: string;
  stage: MatchStage;
  homeTeamId: string;
  awayTeamId: string;
  winnerTeamId: string;
};

export type PredictedPath = {
  groupStandings: Record<string, GroupStanding[]>;
  knockout: KnockoutPathMatch[];
  championTeamId: string;
};

export type ChampionOddsMap = Record<string, number>;

export type SimulationResult = {
  championOdds: ChampionOddsMap;
  predictedPath: PredictedPath;
  iterations: number;
  provider: string;
  model: string;
  runAt: string;
};

export type MissingPairing = {
  homeTeamId: string;
  awayTeamId: string;
  stage: string;
  matchId?: string;
};

/** Probabilities oriented to a specific match's home/away teams. */
export type MatchPredictionView = {
  cacheKey: string;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  predictedScore: string | null;
  keyFactors: string[];
  analysis: string | null;
  provider: string;
  model: string;
  generatedAt: string;
  stale: boolean;
  fromCache: boolean;
};
