import { getMatch, getTeam } from "@/lib/data/load";
import type { MatchPredictionView } from "@/lib/types";
import { createLLMClient } from "./llm";
import { isProviderReady } from "./settings";
import { parseMatchPrediction } from "./parse-response";
import { MATCH_ANALYSIS_SYSTEM_PROMPT, buildMatchUserPrompt } from "./prompts";
import { getPredictionForPair, savePrediction, toMatchView } from "./predictions";

export class AnalyzeMatchError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function analyzeMatch(
  matchId: string,
  options: { refresh?: boolean } = {},
): Promise<MatchPredictionView> {
  const match = getMatch(matchId);
  if (!match) throw new AnalyzeMatchError("Match not found", 404);

  if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") {
    throw new AnalyzeMatchError("Cannot analyze a match with TBD teams", 400);
  }

  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (!home || !away) throw new AnalyzeMatchError("Team data missing", 500);

  if (!isProviderReady()) {
    throw new AnalyzeMatchError(
      "No LLM provider is configured. Add credentials to .env.local",
      503,
    );
  }

  let client;
  try {
    client = createLLMClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM provider unavailable";
    throw new AnalyzeMatchError(msg, 503);
  }

  if (!options.refresh) {
    const cached = getPredictionForPair(home.id, away.id, match.stage, client.config.provider);
    if (cached && cached.stale !== 1) {
      return toMatchView(cached, home.id, away.id, true);
    }
  }

  const userPrompt = buildMatchUserPrompt(match, home, away);
  let raw: string;
  try {
    raw = await client.completeJSON(MATCH_ANALYSIS_SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM request failed";
    throw new AnalyzeMatchError(msg, 503);
  }

  let parsed;
  try {
    parsed = parseMatchPrediction(raw);
  } catch {
    try {
      raw = await client.completeJSON(
        `${MATCH_ANALYSIS_SYSTEM_PROMPT}\nReturn ONLY raw JSON. No other text.`,
        userPrompt,
      );
      parsed = parseMatchPrediction(raw);
    } catch (retryErr) {
      const msg = retryErr instanceof Error ? retryErr.message : "Failed to parse LLM response";
      throw new AnalyzeMatchError(msg, 502);
    }
  }

  const saved = savePrediction({
    homeTeamId: home.id,
    awayTeamId: away.id,
    stage: match.stage,
    provider: client.config.provider,
    model: client.config.model,
    ...parsed,
  });

  return toMatchView(saved, home.id, away.id, false);
}
