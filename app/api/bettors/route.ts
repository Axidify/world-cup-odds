import { NextResponse } from "next/server";
import { z } from "zod";
import { createBettor, listBettors } from "@/lib/betting/store";
import { getDb } from "@/lib/db";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

const bodySchema = z.object({
  name: z.string().min(1).max(64),
});

const BETTOR_LIMIT = 5;

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export async function GET() {
  getDb();
  return NextResponse.json({ bettors: listBettors() });
}

export async function POST(request: Request) {
  getDb();

  const rl = consumeRateLimit(`bettors:${clientIp(request)}`, BETTOR_LIMIT, 60_000);
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
    return NextResponse.json({ error: "name required (1–64 chars)" }, { status: 400 });
  }

  try {
    const bettor = createBettor(parsed.data.name);
    return NextResponse.json({ bettor });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create bettor" },
      { status: 400 },
    );
  }
}
