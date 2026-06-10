import { NextResponse } from "next/server";
import { z } from "zod";
import { placeBet } from "@/lib/betting/place-bet";
import { getBet, listBets } from "@/lib/betting/store";
import { getMatch, getTeam } from "@/lib/data/load";
import { getDb } from "@/lib/db";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

const bodySchema = z.object({
  bettorId: z.string().min(1),
  betType: z.enum(["match", "champion"]),
  matchId: z.string().optional(),
  selection: z.string().min(1),
  stakeMyr: z.coerce.number().positive(),
});

const BET_LIMIT = 20;

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export async function GET(request: Request) {
  getDb();
  const { searchParams } = new URL(request.url);
  const bets = listBets({
    bettorId: searchParams.get("bettorId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    matchId: searchParams.get("matchId") ?? undefined,
    betType: searchParams.get("betType") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 200),
  });

  const enriched = bets.map((bet) => {
    let label = bet.selection;
    if (bet.betType === "champion") {
      label = getTeam(bet.selection)?.name ?? bet.selection;
    } else if (bet.matchId) {
      const match = getMatch(bet.matchId);
      if (match) {
        const home = getTeam(match.homeTeamId);
        const away = getTeam(match.awayTeamId);
        if (bet.selection === "home") label = home?.name ?? "Home";
        else if (bet.selection === "away") label = away?.name ?? "Away";
        else if (bet.selection === "draw") label = "Draw";
      }
    }
    return { ...bet, selectionLabel: label };
  });

  return NextResponse.json({ bets: enriched });
}

export async function POST(request: Request) {
  getDb();

  const rl = consumeRateLimit(`bets:${clientIp(request)}`, BET_LIMIT, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bet request" }, { status: 400 });
  }

  const result = placeBet(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ bet: getBet(result.betId) });
}
