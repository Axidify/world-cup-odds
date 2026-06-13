import { NextResponse } from "next/server";
import { getPendingResults, getResult } from "@/lib/results/store";
import { getAllMatches } from "@/lib/data/load";
import { getDb } from "@/lib/db";
import { isAdminConfigured, verifyAdminPin } from "@/lib/utils/admin";

export async function GET(request: Request) {
  getDb();

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "ADMIN_PIN is not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const pin = searchParams.get("pin");
  if (!pin || !verifyAdminPin(pin)) {
    return NextResponse.json({ error: "Invalid admin PIN" }, { status: 403 });
  }

  const results = getAllMatches()
    .map((m) => getResult(m.id))
    .filter((r): r is NonNullable<typeof r> => r != null);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    results,
    pendingResults: getPendingResults(),
  });
}
