import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  cancelBulkAnalyze,
  getBulkJobState,
  isBulkJobRunning,
  resetBulkJobState,
  runBulkAnalyzeAfterPost,
  writeProvisionalBulkJob,
} from "@/lib/ai/bulk-job";
import { bulkTargetsWhileRunning, countBulkTargetsLight } from "@/lib/ai/preanalyze";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { getDb } from "@/lib/db";
import { isAdminConfigured, verifyAdminPin } from "@/lib/utils/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  refresh: z.boolean().optional(),
  stale: z.boolean().optional(),
  pin: z.string().optional(),
});

const cancelSchema = z.object({
  pin: z.string().optional(),
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
  const targets =
    job.status === "running" ? bulkTargetsWhileRunning(job) : countBulkTargetsLight(false);
  const active = isBulkJobRunning();
  return NextResponse.json({ job, targets, active });
}

export async function POST(request: Request) {
  getDb();

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "ADMIN_PIN is not configured" }, { status: 503 });
  }

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

  if (!verifyAdminPin(parsed.data.pin)) {
    return NextResponse.json({ error: "Invalid admin PIN" }, { status: 403 });
  }

  try {
    const refresh = parsed.data.refresh ?? false;
    const stale = parsed.data.stale ?? false;
    const job = writeProvisionalBulkJob(refresh);

    after(() => {
      void runBulkAnalyzeAfterPost({ refresh, stale });
    });

    return NextResponse.json({ job, active: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to start bulk analyze";
    const status = msg.includes("configured") ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(request: Request) {
  getDb();

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "ADMIN_PIN is not configured" }, { status: 503 });
  }

  let json: unknown = {};
  try {
    const text = await request.text();
    if (text) json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = cancelSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!verifyAdminPin(parsed.data.pin)) {
    return NextResponse.json({ error: "Invalid admin PIN" }, { status: 403 });
  }

  const job = cancelBulkAnalyze();
  return NextResponse.json({ job });
}
