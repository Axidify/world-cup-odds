import { NextResponse } from "next/server";
import { getLeaderboard, getPoolSummary } from "@/lib/betting/leaderboard";
import { getRecentSettlements } from "@/lib/betting/settle";
import { countOpenBets } from "@/lib/betting/store";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  getDb();
  return NextResponse.json({
    summary: getPoolSummary(),
    leaderboard: getLeaderboard(),
    openBets: countOpenBets(),
    recentSettlements: getRecentSettlements(12),
  });
}
