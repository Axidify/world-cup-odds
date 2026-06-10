import { NextResponse } from "next/server";
import { getPendingResults } from "@/lib/results/store";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  getDb();
  const pending = getPendingResults();
  return NextResponse.json({ pending, count: pending.length });
}
