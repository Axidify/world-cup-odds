import { NextResponse } from "next/server";
import { z } from "zod";
import {
  cancelBulkAnalyze,
  getBulkJobState,
  isBulkJobRunning,
  resetBulkJobState,
} from "@/lib/ai/bulk-job";
import { triggerBulkAnalyzeInProcess } from "@/lib/ai/trigger-bulk-analyze";
import { countBulkTargets } from "@/lib/ai/preanalyze";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  refresh: z.boolean().optional(),
});

export async function GET() {
  getDb();
  let job = getBulkJobState();
  const provider = resolveActiveProvider();
  if (
    provider &&
    job.provider &&
    job.provider !== provider &&
    job.status !== "running"
  ) {
    job = resetBulkJobState();
  }
  const targets = countBulkTargets(false);
  const active = isBulkJobRunning();
  return NextResponse.json({ job, targets, active });
}

export async function POST(request: Request) {
  getDb();

  if (isBulkJobRunning()) {
    return NextResponse.json({ error: "Bulk analyze is already running" }, { status: 429 });
  }

  let json: unknown = {};
  try {
    const text = await request.text();
    if (text) json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const job = await triggerBulkAnalyzeInProcess({ refresh: parsed.data.refresh ?? false });
    return NextResponse.json({ job, active: isBulkJobRunning() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to start bulk analyze";
    const status = msg.includes("configured") ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE() {
  getDb();
  const job = cancelBulkAnalyze();
  return NextResponse.json({ job });
}
