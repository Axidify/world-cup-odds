import type { LLMProvider } from "@/lib/types";

export function sortTeamPair(teamA: string, teamB: string): [string, string] {
  return teamA < teamB ? [teamA, teamB] : [teamB, teamA];
}

export function buildCacheKey(
  teamA: string,
  teamB: string,
  stage: string,
  provider: LLMProvider,
  model: string,
  isNeutral = true,
): string {
  const [a, b] = sortTeamPair(teamA, teamB);
  return `${a}|${b}|${stage}|${isNeutral ? 1 : 0}|${provider}|${model}`;
}
