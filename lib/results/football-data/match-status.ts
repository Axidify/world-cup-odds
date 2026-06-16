import type { Match } from "@/lib/types";
import type { FootballDataMatch } from "@/lib/results/football-data/types";
import {
  fetchWorldCupMatches,
  isFootballDataConfigured,
  isLiveFootballDataStatus,
} from "@/lib/results/football-data/client";
import { linksApiMatchToLocal } from "@/lib/results/football-data/sync";

export function findLinkedFootballDataMatch(
  match: Match,
  apiMatches: FootballDataMatch[],
): FootballDataMatch | undefined {
  return apiMatches.find((candidate) => linksApiMatchToLocal(candidate, match));
}

export async function fetchWorldCupMatchesForLocal(
  localMatches: Match[],
): Promise<FootballDataMatch[]> {
  if (!isFootballDataConfigured() || localMatches.length === 0) return [];
  return fetchWorldCupMatches();
}

export function isLinkedMatchInPlayOnFootballData(
  match: Match,
  apiMatches: FootballDataMatch[],
): boolean {
  const api = findLinkedFootballDataMatch(match, apiMatches);
  return api != null && isLiveFootballDataStatus(api.status);
}

export function isLinkedMatchFinishedOnFootballData(
  match: Match,
  apiMatches: FootballDataMatch[],
): boolean {
  const api = findLinkedFootballDataMatch(match, apiMatches);
  return api?.status === "FINISHED";
}
