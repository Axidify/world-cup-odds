import { getResolvedMatch } from "@/lib/data/resolved";
import type { MatchPredictionView } from "@/lib/types";
import { analyzePairing, requireTeams, AnalyzeMatchError } from "./analyze-pairing";
import { buildMatchUserPrompt } from "./prompts";

export { AnalyzeMatchError };

export async function analyzeMatch(
  matchId: string,
  options: { refresh?: boolean; maxAttempts?: number } = {},
): Promise<MatchPredictionView> {
  const match = getResolvedMatch(matchId);
  if (!match) throw new AnalyzeMatchError("Match not found", 404);

  if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") {
    throw new AnalyzeMatchError("Cannot analyze a match with TBD teams", 400);
  }

  const { home, away } = requireTeams(match.homeTeamId, match.awayTeamId);
  const userPrompt = buildMatchUserPrompt(match, home, away);
  return analyzePairing(home, away, match.stage, userPrompt, {
    ...options,
    kickoffIso: match.date,
  });
}
