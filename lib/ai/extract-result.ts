import { z } from "zod";
import type { Match } from "@/lib/types";
import type { SearchSnippet } from "@/lib/search/types";
import { getTeam } from "@/lib/data/load";
import { extractJsonObject } from "./parse-response";
import { createLLMClient } from "./llm";

const extractSchema = z.object({
  homeScore: z.coerce.number().int().min(-1),
  awayScore: z.coerce.number().int().min(-1),
  wentToExtraTime: z.boolean().optional().default(false),
  wentToPenalties: z.boolean().optional().default(false),
  winnerTeamId: z.string().nullable().optional(),
});

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

export async function extractMatchResult(
  match: Match,
  snippets: SearchSnippet[],
): Promise<ExtractedMatchResult | null> {
  if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") return null;
  if (snippets.length === 0) return null;

  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (!home || !away) return null;

  const client = createLLMClient();
  const userPrompt = buildResultExtractionPrompt(match, home.name, away.name, snippets);
  let raw: string;
  try {
    raw = await client.completeJSON(SYSTEM_PROMPT, userPrompt);
  } catch {
    return null;
  }

  let parsed: z.infer<typeof extractSchema>;
  try {
    parsed = extractSchema.parse(JSON.parse(extractJsonObject(raw)));
  } catch {
    return null;
  }

  if (parsed.homeScore < 0 || parsed.awayScore < 0) return null;

  const isKnockout = match.stage !== "group";
  let winnerTeamId = parsed.winnerTeamId ?? null;

  if (isKnockout) {
    if (winnerTeamId !== match.homeTeamId && winnerTeamId !== match.awayTeamId) {
      if (parsed.homeScore > parsed.awayScore) winnerTeamId = match.homeTeamId;
      else if (parsed.awayScore > parsed.homeScore) winnerTeamId = match.awayTeamId;
      // Level score with no extractable winner: keep null so the result
      // stays pending until an admin resolves who advanced.
      else winnerTeamId = null;
    }
  } else {
    winnerTeamId = null;
  }

  return {
    matchId: match.id,
    homeScore: parsed.homeScore,
    awayScore: parsed.awayScore,
    wentToExtraTime: parsed.wentToExtraTime,
    wentToPenalties: parsed.wentToPenalties,
    winnerTeamId,
    source: snippets[0]?.url ?? "search",
  };
}
