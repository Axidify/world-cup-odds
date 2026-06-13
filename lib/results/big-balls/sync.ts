import type { Match } from "@/lib/types";
import { kickoffsAlign } from "@/lib/results/football-data/sync";
import type { ParsedFinishedResult } from "@/lib/results/apply-finished";
import { isFinishedStatus } from "./client";
import { resolveTeamIdFromBigBalls } from "./team";
import type { BigBallsMatch } from "./types";

export function readBigBallsScores(
  api: BigBallsMatch,
): { home: number; away: number } | null {
  const direct = api.score;
  if (direct?.home != null && direct?.away != null) {
    return { home: direct.home, away: direct.away };
  }

  const nested = api.scores?.value;
  if (nested?.home != null && nested?.away != null) {
    return { home: nested.home, away: nested.away };
  }

  return null;
}

function readSide(api: BigBallsMatch, side: "home" | "away") {
  if (side === "home") return api.home ?? api.home_team ?? null;
  return api.away ?? api.away_team ?? null;
}

function kickoffUtc(api: BigBallsMatch): string | null {
  return api.kickoff_utc ?? api.kickoff ?? api.start_time ?? null;
}

export function linksBigBallsMatchToLocal(api: BigBallsMatch, local: Match): boolean {
  if (local.homeTeamId === "TBD" || local.awayTeamId === "TBD") return false;

  const homeId = resolveTeamIdFromBigBalls(readSide(api, "home"));
  const awayId = resolveTeamIdFromBigBalls(readSide(api, "away"));
  if (!homeId || !awayId) return false;
  if (homeId !== local.homeTeamId || awayId !== local.awayTeamId) return false;

  const kickoff = kickoffUtc(api);
  if (!kickoff) return false;
  return kickoffsAlign(local.date, kickoff);
}

export function parseFinishedBigBallsMatch(
  api: BigBallsMatch,
  local: Match,
): ParsedFinishedResult | null {
  if (!isFinishedStatus(api.status)) return null;

  const scores = readBigBallsScores(api);
  if (!scores) return null;

  const pens =
    Boolean(api.went_to_penalties) ||
    api.score?.penalties?.home != null ||
    api.score?.penalties?.away != null;
  const et =
    pens ||
    Boolean(api.went_to_extra_time) ||
    api.score?.extra_time?.home != null ||
    api.score?.extra_time?.away != null;

  let winnerTeamId: string | null = null;
  if (local.stage !== "group") {
    const winner = (api.winner ?? "").toString().toLowerCase();
    if (winner === "home") winnerTeamId = local.homeTeamId;
    else if (winner === "away") winnerTeamId = local.awayTeamId;
    else if (scores.home > scores.away) winnerTeamId = local.homeTeamId;
    else if (scores.away > scores.home) winnerTeamId = local.awayTeamId;
  }

  return {
    homeScore: scores.home,
    awayScore: scores.away,
    et,
    pens,
    winnerTeamId,
    source: JSON.stringify({
      provider: "bigballsdata.com",
      apiMatchId: api.id,
      status: api.status,
      syncedAt: new Date().toISOString(),
    }),
  };
}

export function indexFinishedBigBallsMatches(
  apiMatches: BigBallsMatch[],
  localMatches: Match[],
): Map<string, ParsedFinishedResult> {
  const out = new Map<string, ParsedFinishedResult>();
  const finished = apiMatches.filter((m) => isFinishedStatus(m.status));

  for (const local of localMatches) {
    const api = finished.find((candidate) => linksBigBallsMatchToLocal(candidate, local));
    if (!api) continue;
    const parsed = parseFinishedBigBallsMatch(api, local);
    if (parsed) out.set(local.id, parsed);
  }

  return out;
}
