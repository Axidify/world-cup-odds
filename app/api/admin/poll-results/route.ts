import { NextResponse } from "next/server";
import { z } from "zod";
import { runResultsPollJob } from "@/lib/jobs/poll-results";
import { getPendingResults } from "@/lib/results/store";
import { isAdminConfigured, verifyAdminPin } from "@/lib/utils/admin";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  pin: z.string().min(1),
});

export async function POST(request: Request) {
  getDb();

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "ADMIN_PIN is not configured" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!verifyAdminPin(parsed.data.pin)) {
    return NextResponse.json({ error: "Invalid admin PIN" }, { status: 403 });
  }

  const summary = await runResultsPollJob();
  return NextResponse.json({
    summary,
    pendingResults: getPendingResults(),
  });
}
