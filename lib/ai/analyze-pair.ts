import { getTeam } from "@/lib/data/load";
import type { MatchPredictionView } from "@/lib/types";
import { createLLMClient } from "./llm";
import { isProviderReady } from "./settings";
import { parseMatchPrediction } from "./parse-response";
import { MATCH_ANALYSIS_SYSTEM_PROMPT, buildKnockoutPairPrompt } from "./prompts";
import { getPredictionForPair, savePrediction, toMatchView } from "./predictions";
import { AnalyzeMatchError } from "./analyze-match";

export async function analyzePair(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  options: { refresh?: boolean } = {},
): Promise<MatchPredictionView> {
  const home = getTeam(homeTeamId);
  const away = getTeam(awayTeamId);
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
    const cached = getPredictionForPair(home.id, away.id, stage, client.config.provider);
    if (cached && cached.stale !== 1) {
      return toMatchView(cached, home.id, away.id, true);
    }
  }

  const userPrompt = buildKnockoutPairPrompt(home, away, stage);
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
    stage,
    provider: client.config.provider,
    model: client.config.model,
    ...parsed,
  });

  return toMatchView(saved, home.id, away.id, false);
}
