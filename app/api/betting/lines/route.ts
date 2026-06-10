import { NextResponse } from "next/server";
import { getChampionOddsLine, getMatchOddsSnapshot } from "@/lib/betting/lines";
import { getTournamentLockAt, isMatchBettingLocked, isTournamentLocked } from "@/lib/betting/locks";
import { getMatch } from "@/lib/data/load";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  getDb();
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId");
  const teamId = searchParams.get("teamId");

  if (matchId) {
    const match = getMatch(matchId);
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    const snapshot = getMatchOddsSnapshot(matchId);
    return NextResponse.json({
      type: "match",
      locked: isMatchBettingLocked(match),
      snapshot,
    });
  }

  if (teamId) {
    const line = getChampionOddsLine(teamId);
    return NextResponse.json({
      type: "champion",
      locked: isTournamentLocked(),
      lockAt: getTournamentLockAt(),
      line,
    });
  }

  return NextResponse.json({ error: "matchId or teamId required" }, { status: 400 });
}
