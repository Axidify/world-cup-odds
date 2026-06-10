import { NextResponse } from "next/server";
import { z } from "zod";
import { getBet } from "@/lib/betting/store";
import { voidBet } from "@/lib/betting/settle";
import { getDb } from "@/lib/db";
import { isAdminConfigured, verifyAdminPin } from "@/lib/utils/admin";

const bodySchema = z.object({
  pin: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  getDb();
  const { id } = await params;

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

  const existing = getBet(id);
  if (!existing) {
    return NextResponse.json({ error: "Bet not found" }, { status: 404 });
  }

  if (!voidBet(id)) {
    return NextResponse.json({ error: "Bet could not be voided" }, { status: 400 });
  }

  return NextResponse.json({ bet: getBet(id) });
}
