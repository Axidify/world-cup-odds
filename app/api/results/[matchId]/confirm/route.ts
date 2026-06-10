import { NextResponse } from "next/server";
import { z } from "zod";
import { finalizeResultConfirmation } from "@/lib/results/on-confirm";
import { getResult } from "@/lib/results/store";
import { isAdminConfigured, verifyAdminPin } from "@/lib/utils/admin";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  pin: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  getDb();
  const { matchId } = await params;

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
    return NextResponse.json({ error: "pin required" }, { status: 400 });
  }

  if (!verifyAdminPin(parsed.data.pin)) {
    return NextResponse.json({ error: "Invalid admin PIN" }, { status: 403 });
  }

  const existing = getResult(matchId);
  if (!existing) {
    return NextResponse.json({ error: "No result found for this match" }, { status: 404 });
  }
  if (existing.confirmed) {
    return NextResponse.json({ result: existing, alreadyConfirmed: true });
  }

  const ok = finalizeResultConfirmation(matchId, "admin");
  if (!ok) {
    return NextResponse.json({ error: "Failed to confirm result" }, { status: 500 });
  }

  return NextResponse.json({ result: getResult(matchId) });
}
