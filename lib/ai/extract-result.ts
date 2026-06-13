import { z } from "zod";
import type { Match } from "@/lib/types";
import type { SearchSnippet } from "@/lib/search/types";
import { getTeam } from "@/lib/data/load";
import { extractJsonObject } from "./parse-response";
import { createLLMClient } from "./llm";
import { parseScoreFromText, snippetsAgreeOnScore } from "@/lib/results/score-agreement";

const extractSchema = z.object({
  homeScore: z.number().int().min(-1),
  awayScore: z.number().int().min(-1),
  wentToExtraTime: z.boolean().optional().default(false),
  wentToPenalties: z.boolean().optional().default(false),
  winnerTeamId: z.string().nullable().optional(),
});

function readScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

/** Gemini often nests scores — normalize before Zod validation. */
export function normalizeExtractedResult(raw: unknown): z.infer<typeof extractSchema> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const nestedResult =
    o.result && typeof o.result === "object" ? (o.result as Record<string, unknown>) : null;
  const nestedScore =
    o.score && typeof o.score === "object" ? (o.score as Record<string, unknown>) : null;

  const homeScore =
    readScore(o.homeScore) ??
    readScore(o.home_score) ??
    readScore(nestedScore?.home) ??
    readScore(nestedScore?.homeScore) ??
    readScore(nestedScore?.home_score) ??
    readScore(nestedResult?.home_score) ??
    readScore(nestedResult?.homeScore) ??
    -1;
  const awayScore =
    readScore(o.awayScore) ??
    readScore(o.away_score) ??
    readScore(nestedScore?.away) ??
    readScore(nestedScore?.awayScore) ??
    readScore(nestedScore?.away_score) ??
    readScore(nestedResult?.away_score) ??
    readScore(nestedResult?.awayScore) ??
    -1;

  const winnerRaw = o.winnerTeamId ?? o.winner_team_id ?? nestedResult?.winning_team;
  const winnerTeamId =
    typeof winnerRaw === "string" && winnerRaw.trim() ? winnerRaw.trim() : null;

  try {
    return extractSchema.parse({
      homeScore,
      awayScore,
      wentToExtraTime: Boolean(o.wentToExtraTime ?? o.went_to_extra_time ?? nestedResult?.et),
      wentToPenalties: Boolean(o.wentToPenalties ?? o.went_to_penalties ?? nestedResult?.pens),
      winnerTeamId,
    });
  } catch {
    return null;
  }
}

export type ExtractedMatchResult = {
  matchId: string;
  homeScore: number;
  awayScore: number;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
  winnerTeamId: string | null;
  source: string;
};

const SYSTEM_PROMPT = `You extract FIFA World Cup match results from web search snippets.
Respond with ONLY valid JSON — no markdown, no commentary.

Required JSON shape:
{
  "homeScore": number,
  "awayScore": number,
  "wentToExtraTime": boolean,
  "wentToPenalties": boolean,
  "winnerTeamId": string | null
}

Rules:
- homeScore/awayScore are full-time goals for the HOME team named in the user message vs AWAY team.
- For knockout matches with no draw, winnerTeamId must be the team id that advanced (home or away id from the message).
- For group-stage draws, winnerTeamId is null.
- If the final score cannot be determined from the snippets, return homeScore: -1, awayScore: -1.`;

export function buildResultExtractionPrompt(
  match: Match,
  homeName: string,
  awayName: string,
  snippets: SearchSnippet[],
): string {
  const snippetBlock = snippets
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.content}`)
    .join("\n\n");

  return `Extract the final score for this World Cup match from the search snippets below.

Match ID: ${match.id}
HOME: ${homeName} (id: ${match.homeTeamId})
AWAY: ${awayName} (id: ${match.awayTeamId})
Stage: ${match.stage}
Date: ${match.date}
Venue: ${match.venue}

Search snippets:
${snippetBlock}

Return JSON only.`;
}

function snippetMentionsTeam(text: string, teamId: string, name: string): boolean {
  const lower = text.toLowerCase();
  const tokens = [teamId, name, ...name.split(/\s+/)].filter((t) => t.length >= 3);
  return tokens.some((t) => lower.includes(t.toLowerCase()));
}

/** Regex fallback when LLM JSON shape or confidence fails. */
export function tryParseScoreFromSnippets(
  match: Match,
  snippets: SearchSnippet[],
): { homeScore: number; awayScore: number } | null {
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (!home || !away) return null;

  for (const s of snippets) {
    const text = `${s.title} ${s.content}`;
    if (!snippetMentionsTeam(text, match.homeTeamId, home.name)) continue;
    if (!snippetMentionsTeam(text, match.awayTeamId, away.name)) continue;
    const parsed = parseScoreFromText(text);
    if (parsed) return parsed;
  }
  return null;
}

/** Regex + multi-snippet agreement — no LLM. */
export function extractScoreFromSnippetsRegex(
  match: Match,
  snippets: SearchSnippet[],
): { homeScore: number; awayScore: number } | null {
  const fromText = tryParseScoreFromSnippets(match, snippets);
  if (!fromText) return null;
  if (!snippetsAgreeOnScore(snippets, fromText)) return null;
  return fromText;
}

function buildResultFromScores(
  match: Match,
  homeScore: number,
  awayScore: number,
  options: {
    wentToExtraTime?: boolean;
    wentToPenalties?: boolean;
    winnerTeamId?: string | null;
    source?: string;
  } = {},
): ExtractedMatchResult {
  const isKnockout = match.stage !== "group";
  let winnerTeamId = options.winnerTeamId ?? null;

  if (isKnockout) {
    if (winnerTeamId !== match.homeTeamId && winnerTeamId !== match.awayTeamId) {
      if (homeScore > awayScore) winnerTeamId = match.homeTeamId;
      else if (awayScore > homeScore) winnerTeamId = match.awayTeamId;
      else winnerTeamId = null;
    }
  } else {
    winnerTeamId = null;
  }

  return {
    matchId: match.id,
    homeScore,
    awayScore,
    wentToExtraTime: options.wentToExtraTime ?? false,
    wentToPenalties: options.wentToPenalties ?? false,
    winnerTeamId,
    source: options.source ?? "search",
  };
}

export async function extractMatchResult(
  match: Match,
  snippets: SearchSnippet[],
): Promise<ExtractedMatchResult | null> {
  if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") return null;
  if (snippets.length === 0) return null;

  const regexScore = extractScoreFromSnippetsRegex(match, snippets);
  if (regexScore) {
    return buildResultFromScores(match, regexScore.homeScore, regexScore.awayScore, {
      source: snippets[0]?.url ?? "search-regex",
    });
  }

  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (!home || !away) return null;

  let parsed: z.infer<typeof extractSchema> | null = null;

  const client = createLLMClient();
  const userPrompt = buildResultExtractionPrompt(match, home.name, away.name, snippets);
  try {
    const raw = await client.completeJSON(SYSTEM_PROMPT, userPrompt);
    parsed = normalizeExtractedResult(JSON.parse(extractJsonObject(raw)));
  } catch {
    parsed = null;
  }

  if (!parsed || parsed.homeScore < 0 || parsed.awayScore < 0) {
    const fromText = tryParseScoreFromSnippets(match, snippets);
    if (!fromText) return null;
    parsed = {
      homeScore: fromText.homeScore,
      awayScore: fromText.awayScore,
      wentToExtraTime: false,
      wentToPenalties: false,
      winnerTeamId: null,
    };
  }

  return buildResultFromScores(match, parsed.homeScore, parsed.awayScore, {
    wentToExtraTime: parsed.wentToExtraTime,
    wentToPenalties: parsed.wentToPenalties,
    winnerTeamId: parsed.winnerTeamId ?? null,
    source: snippets[0]?.url ?? "search",
  });
}
