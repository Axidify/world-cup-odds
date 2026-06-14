import type { ParsedFinishedResult } from "@/lib/results/apply-finished";
import { getLiveScore, type LiveScoreRow } from "@/lib/results/live-scores/store";

/** How long a last in-play snapshot remains usable for FT confirmation. */
export const LIVE_SNAPSHOT_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export function getCorroboratingLiveScore(matchId: string, now = Date.now()): LiveScoreRow | null {
  const live = getLiveScore(matchId);
  if (!live) return null;

  const age = now - new Date(live.syncedAt).getTime();
  if (age > LIVE_SNAPSHOT_MAX_AGE_MS) return null;

  return live;
}

export type ParsedFinishedWithLive = ParsedFinishedResult & {
  corroboratedByLive?: boolean;
};

/** Prefer the last in-play snapshot when the FINISHED feed looks stale. */
export function applyLastLiveScoreToFinished(
  matchId: string,
  parsed: ParsedFinishedResult,
  now = Date.now(),
): ParsedFinishedWithLive {
  const live = getCorroboratingLiveScore(matchId, now);
  if (!live) return parsed;

  const agrees =
    live.homeScore === parsed.homeScore && live.awayScore === parsed.awayScore;

  if (agrees) {
    return { ...parsed, corroboratedByLive: true };
  }

  return {
    ...parsed,
    homeScore: live.homeScore,
    awayScore: live.awayScore,
    corroboratedByLive: true,
    source: JSON.stringify({
      provider: "football-data.org+live-snapshot",
      liveSyncedAt: live.syncedAt,
      liveMinute: live.minute,
      apiScores: { home: parsed.homeScore, away: parsed.awayScore },
      correctedAt: new Date(now).toISOString(),
    }),
  };
}

export function applyLastLiveScoreToFinishedMap(
  finishedByMatchId: Map<string, ParsedFinishedResult>,
  now = Date.now(),
): Map<string, ParsedFinishedWithLive> {
  const out = new Map<string, ParsedFinishedWithLive>();
  for (const [matchId, parsed] of finishedByMatchId) {
    out.set(matchId, applyLastLiveScoreToFinished(matchId, parsed, now));
  }
  return out;
}
