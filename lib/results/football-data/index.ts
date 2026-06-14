export {
  checkFootballDataHealth,
  fetchFootballDataMatch,
  fetchLiveWorldCupMatches,
  fetchWorldCupMatches,
  getFootballDataSeason,
  getFootballDataStatus,
  isFootballDataConfigured,
  isLiveFootballDataStatus,
} from "@/lib/results/football-data/client";
export type { FootballDataStatus } from "@/lib/results/football-data/client";
export { pollResultsFromFootballData } from "@/lib/results/football-data/poll";
export {
  enrichLiveFootballDataMatches,
  formatLiveFootballDataMinute,
  indexFinishedMatches,
  kickoffsAlign,
  linksApiMatchToLocal,
  mapLiveFootballDataToLocal,
  parseFinishedApiMatch,
  readLiveFootballDataScores,
} from "@/lib/results/football-data/sync";
export { resolveTeamIdFromApi, teamIdToTla } from "@/lib/results/football-data/team-tla";
export type { FootballDataMatch, FootballDataMatchStatus } from "@/lib/results/football-data/types";
