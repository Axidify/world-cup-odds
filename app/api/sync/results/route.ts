import { NextResponse } from "next/server";
import { z } from "zod";
import { applyAdminConfirmedResult } from "@/lib/results/on-confirm";
import { getResult } from "@/lib/results/store";
import { verifyAdminPin, isAdminConfigured } from "@/lib/utils/admin";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  pin: z.string().min(1),
  matchId: z.string().min(1),
  homeScore: z.coerce.number().int().min(0),
  awayScore: z.coerce.number().int().min(0),
  et: z.boolean().optional(),
  pens: z.boolean().optional(),
  winnerTeamId: z.string().nullable().optional(),
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

  const match = getResolvedMatch(parsed.data.matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const ok = applyAdminConfirmedResult({
    matchId: parsed.data.matchId,
    homeScore: parsed.data.homeScore,
    awayScore: parsed.data.awayScore,
    et: parsed.data.et,
    pens: parsed.data.pens,
    winnerTeamId: parsed.data.winnerTeamId,
    source: "admin-manual",
  });

  if (!ok) {
    if (match.stage !== "group" && parsed.data.homeScore === parsed.data.awayScore) {
      return NextResponse.json(
        { error: "Knockout draw requires winnerTeamId (ET/pens winner)" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Failed to save result" }, { status: 500 });
  }

  return NextResponse.json({ result: getResult(parsed.data.matchId) });
}
