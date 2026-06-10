import { NextResponse } from "next/server";
import { getLatestSimulation } from "@/lib/sim/simulation-cache";
import { getDb } from "@/lib/db";

export async function GET() {
  getDb();
  const latest = getLatestSimulation();
  if (!latest) {
    return NextResponse.json({ simulation: null });
  }
  return NextResponse.json({ simulation: latest });
}
