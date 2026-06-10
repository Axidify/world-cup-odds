import { NextResponse } from "next/server";
import { z } from "zod";
import { isProviderReady } from "@/lib/ai/settings";
import { getMatch, getTeam } from "@/lib/data/load";
import { pollTeamNews } from "@/lib/jobs/poll-news";
import { getTeamNewsSummary } from "@/lib/news/store";
import { isSearchConfigured } from "@/lib/search/provider";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  matchId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  getDb();

  if (!isSearchConfigured()) {
    return NextResponse.json({ error: "No search provider is configured" }, { status: 503 });
  }
  if (!isProviderReady()) {
    return NextResponse.json({ error: "No LLM provider is configured" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success || (!parsed.data.matchId && !parsed.data.teamId)) {
    return NextResponse.json({ error: "matchId or teamId required" }, { status: 400 });
  }

  const teamIds: string[] = [];
  if (parsed.data.teamId) {
    if (!getTeam(parsed.data.teamId)) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    teamIds.push(parsed.data.teamId);
  } else if (parsed.data.matchId) {
    const match = getMatch(parsed.data.matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (match.homeTeamId !== "TBD") teamIds.push(match.homeTeamId);
    if (match.awayTeamId !== "TBD") teamIds.push(match.awayTeamId);
  }

  if (teamIds.length === 0) {
    return NextResponse.json({ error: "No teams available to sync for this match" }, { status: 400 });
  }

  const outcomes: Record<string, string> = {};
  for (const teamId of teamIds) {
    outcomes[teamId] = await pollTeamNews(teamId, { force: true });
  }

  if (teamIds.length > 0 && Object.values(outcomes).every((o) => o === "failed")) {
    return NextResponse.json(
      { error: "News sync failed for all teams", outcomes },
      { status: 502 },
    );
  }

  return NextResponse.json({
    outcomes,
    summaries: Object.fromEntries(teamIds.map((id) => [id, getTeamNewsSummary(id)])),
    matchId: parsed.data.matchId ?? null,
  });
}
