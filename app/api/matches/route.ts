import { NextResponse } from "next/server";
import { getTeams } from "@/lib/data/load";
import { getResolvedMatches } from "@/lib/data/resolved";
import { getDb } from "@/lib/db";

export async function GET() {
  getDb();
  const matches = getResolvedMatches();
  return NextResponse.json({
    teams: getTeams(),
    matches,
    count: matches.length,
  });
}
