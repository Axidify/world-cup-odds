import { NextResponse } from "next/server";
import { getAccuracySummary } from "@/lib/calibration/metrics";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  getDb();
  const summary = getAccuracySummary();
  return NextResponse.json(summary);
}
