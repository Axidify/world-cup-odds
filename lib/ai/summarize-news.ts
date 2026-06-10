import { z } from "zod";
import { getTeam } from "@/lib/data/load";
import type { SearchSnippet } from "@/lib/search/types";
import { extractJsonObject } from "./parse-response";
import { createLLMClient } from "./llm";

const eventSchema = z.object({
  type: z.enum(["injury", "suspension", "return", "card", "other"]),
  player: z.string().nullable().optional(),
  detail: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

const extractSchema = z.object({
  teamId: z.string(),
  events: z.array(eventSchema).default([]),
  summary: z.string().default(""),
});

export type ExtractedTeamNews = {
  teamId: string;
  events: Array<{
    type: string;
    player: string | null;
    detail: string | null;
    source: string | null;
  }>;
  summary: string;
};

const SYSTEM_PROMPT = `You extract FIFA World Cup team news from web search snippets.
Respond with ONLY valid JSON — no markdown, no commentary.

Required JSON shape:
{
  "teamId": string,
  "events": [
    {
      "type": "injury" | "suspension" | "return" | "card" | "other",
      "player": string | null,
      "detail": string | null,
      "source": string | null
    }
  ],
  "summary": string
}

Rules:
- teamId must match the team id in the user message.
- Only include events clearly supported by the snippets (injuries, suspensions, returns, card accumulation).
- summary is 1-2 sentences for the coaching staff preview.
- If no relevant news, return events: [] and summary: "No significant squad news in recent sources."`;

export function buildTeamNewsPrompt(
  teamId: string,
  teamName: string,
  snippets: SearchSnippet[],
): string {
  const snippetBlock = snippets
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.content}`)
    .join("\n\n");

  return `Extract squad news for this World Cup team from the search snippets below.

Team: ${teamName} (id: ${teamId})

Search snippets:
${snippetBlock}

Return JSON only.`;
}

export async function extractTeamNews(
  teamId: string,
  snippets: SearchSnippet[],
): Promise<ExtractedTeamNews | null> {
  const team = getTeam(teamId);
  if (!team || snippets.length === 0) return null;

  const client = createLLMClient();
  let raw: string;
  try {
    raw = await client.completeJSON(SYSTEM_PROMPT, buildTeamNewsPrompt(teamId, team.name, snippets));
  } catch {
    return null;
  }

  let parsed: z.infer<typeof extractSchema>;
  try {
    parsed = extractSchema.parse(JSON.parse(extractJsonObject(raw)));
  } catch {
    return null;
  }

  if (parsed.teamId !== teamId) {
    parsed = { ...parsed, teamId };
  }

  return {
    teamId,
    events: parsed.events.map((e) => ({
      type: e.type,
      player: e.player ?? null,
      detail: e.detail ?? null,
      source: e.source ?? snippets[0]?.url ?? null,
    })),
    summary: parsed.summary.trim() || "No significant squad news in recent sources.",
  };
}
