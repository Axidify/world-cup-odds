import { NextResponse } from "next/server";
import { getAllMatches, getTeams } from "@/lib/data/load";
import { getDb } from "@/lib/db";

export async function GET() {
  getDb();
  return NextResponse.json({
    teams: getTeams(),
    matches: getAllMatches(),
    count: getAllMatches().length,
  });
}
