import { NextResponse } from "next/server";
import { isBigBallsConfigured } from "@/lib/results/big-balls";
import { listLiveScores } from "@/lib/results/live-scores/store";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  getDb();
  const scores = listLiveScores();

  return NextResponse.json({
    configured: isBigBallsConfigured(),
    scores: Object.fromEntries(
      scores.map((row) => [
        row.matchId,
        {
          homeScore: row.homeScore,
          awayScore: row.awayScore,
          status: row.status,
          minute: row.minute,
          syncedAt: row.syncedAt,
        },
      ]),
    ),
    count: scores.length,
  });
}
