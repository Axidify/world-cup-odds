import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeMatch, AnalyzeMatchError } from "@/lib/ai/analyze-match";
import { isBulkJobRunning } from "@/lib/ai/bulk-job";
import { getPredictionForPair, toMatchView } from "@/lib/ai/predictions";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { getMatch } from "@/lib/data/load";
import { getDb } from "@/lib/db";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

const bodySchema = z.object({
  matchId: z.string().min(1),
  refresh: z.boolean().optional(),
});

const ANALYZE_LIMIT = Number(process.env.ANALYZE_RATE_LIMIT_PER_MIN ?? 30);

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
  const matchId = searchParams.get("matchId");
  if (!matchId) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 });
  }

  const match = getMatch(matchId);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") {
    return NextResponse.json({ prediction: null });
  }

  const cached = getPredictionForPair(match.homeTeamId, match.awayTeamId, match.stage);
  if (!cached) return NextResponse.json({ prediction: null });

  return NextResponse.json({
    prediction: toMatchView(cached, match.homeTeamId, match.awayTeamId, true),
  });
}

export async function POST(request: Request) {
  getDb();

  if (isBulkJobRunning()) {
    return NextResponse.json(
      { error: "Bulk analyze is running — try again when it finishes" },
      { status: 429 },
    );
  }

  const rl = consumeRateLimit(`analyze:${clientIp(request)}`, ANALYZE_LIMIT, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
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
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const prediction = await analyzeMatch(parsed.data.matchId, {
      refresh: parsed.data.refresh ?? false,
    });
    return NextResponse.json({
      prediction,
      provider: resolveActiveProvider(),
    });
  } catch (err) {
    if (err instanceof AnalyzeMatchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
