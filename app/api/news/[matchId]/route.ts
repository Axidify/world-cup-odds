import { NextResponse } from "next/server";
import { getEloRating } from "@/lib/calibration/elo";
import { getTeam } from "@/lib/data/load";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getTeamNewsImpact, isNewsImpactEnabled } from "@/lib/news/impact";
import { getTeamNewsSummary } from "@/lib/news/store";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  getDb();
  const { matchId } = await params;
  const match = getResolvedMatch(matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") {
    return NextResponse.json({ home: null, away: null });
  }

  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (!home || !away) {
    return NextResponse.json({ error: "Team data missing" }, { status: 500 });
  }

  const impactEnabled = isNewsImpactEnabled();
  return NextResponse.json({
    matchId,
    home: {
      ...getTeamNewsSummary(home.id),
      teamName: home.name,
      elo: getEloRating(home.id),
      impact: impactEnabled ? getTeamNewsImpact(home.id) : null,
    },
    away: {
      ...getTeamNewsSummary(away.id),
      teamName: away.name,
      elo: getEloRating(away.id),
      impact: impactEnabled ? getTeamNewsImpact(away.id) : null,
    },
  });
}
