import { getTeam } from "@/lib/data/load";
import type { MatchPredictionView, Team } from "@/lib/types";
import type { LLMClient } from "./types";
import { createLLMClient } from "./llm";
import { isProviderReady } from "./settings";
import { parseMatchPrediction } from "./parse-response";
import { MATCH_ANALYSIS_SYSTEM_PROMPT } from "./prompts";
import {
  resolveFixtureProbabilities,
  shouldUseCachedPredictionForAnalyze,
  toMatchPredictionView,
} from "@/lib/predictions/resolve-fixture-probs";
import { savePrediction, toMatchView } from "./predictions";
import { applyNewsImpactToView } from "@/lib/news/impact";

export class AnalyzeMatchError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const DEFAULT_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callLlmAndParse(
  client: LLMClient,
  userPrompt: string,
): Promise<ReturnType<typeof parseMatchPrediction>> {
  let raw: string;
  try {
    raw = await client.completeJSON(MATCH_ANALYSIS_SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM request failed";
    throw new AnalyzeMatchError(msg, 503);
  }

  try {
    return parseMatchPrediction(raw);
  } catch {
    try {
      raw = await client.completeJSON(
        `${MATCH_ANALYSIS_SYSTEM_PROMPT}\nReturn ONLY raw JSON. No other text.`,
        userPrompt,
      );
      return parseMatchPrediction(raw);
    } catch (retryErr) {
      const msg = retryErr instanceof Error ? retryErr.message : "Failed to parse LLM response";
      throw new AnalyzeMatchError(msg, 502);
    }
  }
}

export async function analyzePairing(
  home: Team,
  away: Team,
  stage: string,
  userPrompt: string,
  options: { refresh?: boolean; maxAttempts?: number; kickoffIso?: string } = {},
): Promise<MatchPredictionView> {
  if (!isProviderReady()) {
    throw new AnalyzeMatchError(
      "No LLM provider is configured. Add credentials to .env.local",
      503,
    );
  }

  let client: LLMClient;
  try {
    client = createLLMClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM provider unavailable";
    throw new AnalyzeMatchError(msg, 503);
  }

  if (!options.refresh) {
    const resolved = resolveFixtureProbabilities(home.id, away.id, stage, {
      provider: client.config.provider,
      kickoffIso: options.kickoffIso,
    });
    if (resolved && shouldUseCachedPredictionForAnalyze(resolved, false)) {
      return toMatchPredictionView(resolved, home.id, away.id, options.kickoffIso);
    }
  }

  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: AnalyzeMatchError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(attempt * 1500);
    try {
      const parsed = await callLlmAndParse(client, userPrompt);
      const saved = savePrediction({
        homeTeamId: home.id,
        awayTeamId: away.id,
        stage,
        provider: client.config.provider,
        model: client.config.model,
        ...parsed,
      });
      return applyNewsImpactToView(
        toMatchView(saved, home.id, away.id, false, "fresh"),
        home.id,
        away.id,
        options.kickoffIso,
      );
    } catch (err) {
      if (err instanceof AnalyzeMatchError) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new AnalyzeMatchError("Analysis failed", 500);
}

export function requireTeams(
  homeTeamId: string,
  awayTeamId: string,
): { home: Team; away: Team } {
  const home = getTeam(homeTeamId);
  const away = getTeam(awayTeamId);
  if (!home || !away) throw new AnalyzeMatchError("Team data missing", 500);
  return { home, away };
}
