import type { Match } from "@/lib/types";
import { listMatchesInLiveWindow, msUntilNextLiveWindow } from "@/lib/match/live-window";
import { fetchWc2026Matches, isBigBallsConfigured } from "@/lib/results/big-balls/client";
import { linksBigBallsMatchToLocal, readBigBallsScores } from "@/lib/results/big-balls/sync";
import type { BigBallsMatch } from "@/lib/results/big-balls/types";
import {
  clearLiveScores,
  deleteLiveScoresExcept,
  upsertLiveScore,
} from "@/lib/results/live-scores/store";

export function getLiveScoresPollIntervalMs(): number {
  const raw = Number(process.env.LIVE_SCORES_POLL_INTERVAL_SECONDS ?? 60);
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : 60;
  return Math.max(15, seconds) * 1000;
}

export function mapLiveApiToLocal(
  apiMatches: BigBallsMatch[],
  localMatches: Match[],
): Array<{ matchId: string; homeScore: number; awayScore: number; status: string | null; minute: string | null }> {
  const out: Array<{
    matchId: string;
    homeScore: number;
    awayScore: number;
    status: string | null;
    minute: string | null;
  }> = [];

  for (const local of localMatches) {
    const api = apiMatches.find((candidate) => linksBigBallsMatchToLocal(candidate, local));
    if (!api) continue;

    const scores = readBigBallsScores(api);
    if (!scores) continue;

    out.push({
      matchId: local.id,
      homeScore: scores.home,
      awayScore: scores.away,
      status: api.status ?? null,
      minute: api.minute != null ? String(api.minute) : api.period ?? null,
    });
  }

  return out;
}

export async function runLiveScoresPollJob(now = Date.now()): Promise<{
  polled: boolean;
  synced: number;
  localLive: number;
  configured: boolean;
}> {
  const localLive = listMatchesInLiveWindow(now);

  if (!isBigBallsConfigured()) {
    if (localLive.length > 0) {
      console.warn("[poller] live-scores: BBS_API_KEY not set — live scores unavailable");
    }
    return { polled: false, synced: 0, localLive: localLive.length, configured: false };
  }

  if (localLive.length === 0) {
    clearLiveScores();
    return { polled: false, synced: 0, localLive: 0, configured: true };
  }

  let apiMatches: BigBallsMatch[];
  try {
    apiMatches = await fetchWc2026Matches({ status: "live" });
  } catch (err) {
    console.warn("[poller] live-scores:", err instanceof Error ? err.message : err);
    return { polled: true, synced: 0, localLive: localLive.length, configured: true };
  }

  const mapped = mapLiveApiToLocal(apiMatches, localLive);
  for (const row of mapped) {
    upsertLiveScore(row);
  }

  deleteLiveScoresExcept(mapped.map((row) => row.matchId));

  const { recordPollerRun } = await import("@/lib/ops/poller-heartbeat");
  recordPollerRun("live_scores");

  if (mapped.length === 0 && localLive.length > 0) {
    console.warn(
      `[poller] live-scores: ${localLive.length} local live match(es), 0 linked from Big Balls`,
    );
  }

  return {
    polled: true,
    synced: mapped.length,
    localLive: localLive.length,
    configured: true,
  };
}

export function getLiveScoresPollPlan(now = Date.now()): {
  shouldPoll: boolean;
  delayMs: number;
  reason: string;
} {
  const intervalMs = getLiveScoresPollIntervalMs();
  const localLive = listMatchesInLiveWindow(now);

  if (localLive.length > 0) {
    return {
      shouldPoll: true,
      delayMs: intervalMs,
      reason: `${localLive.length} match${localLive.length === 1 ? "" : "es"} live`,
    };
  }

  const nextKickoff = msUntilNextLiveWindow(now);
  const idleCap = 5 * 60 * 1000;
  const delayMs =
    nextKickoff == null
      ? idleCap
      : Math.max(intervalMs, Math.min(nextKickoff - now, idleCap));

  return {
    shouldPoll: false,
    delayMs: Math.max(60_000, delayMs),
    reason: nextKickoff == null ? "no upcoming fixtures" : "waiting for next kickoff",
  };
}
