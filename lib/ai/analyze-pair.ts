import type { MatchPredictionView } from "@/lib/types";
import { analyzePairing, requireTeams } from "./analyze-pairing";
import { buildKnockoutPairPrompt } from "./prompts";

export { AnalyzeMatchError } from "./analyze-pairing";

export async function analyzePair(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  options: { refresh?: boolean } = {},
): Promise<MatchPredictionView> {
  const { home, away } = requireTeams(homeTeamId, awayTeamId);
  const userPrompt = buildKnockoutPairPrompt(home, away, stage);
  return analyzePairing(home, away, stage, userPrompt, options);
}
