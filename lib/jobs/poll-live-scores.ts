import { listMatchesInLiveWindow, msUntilNextLiveWindow } from "@/lib/match/live-window";
import {
  enrichLiveFootballDataMatches,
  fetchFootballDataMatch,
  fetchLiveWorldCupMatches,
  isFootballDataConfigured,
  mapLiveFootballDataToLocal,
} from "@/lib/results/football-data";
import {
  clearLiveScores,
  deleteLiveScoresExcept,
  upsertLiveScore,
} from "@/lib/results/live-scores/store";

export function getLiveScoresPollIntervalSeconds(): number {
  const raw = Number(process.env.LIVE_SCORES_POLL_INTERVAL_SECONDS ?? 60);
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : 60;
  return Math.max(15, seconds);
}

export function getLiveScoresPollIntervalMs(): number {
  return getLiveScoresPollIntervalSeconds() * 1000;
}

export async function runLiveScoresPollJob(now = Date.now()): Promise<{
  polled: boolean;
  synced: number;
  localLive: number;
  configured: boolean;
}> {
  const localLive = listMatchesInLiveWindow(now);

  if (!isFootballDataConfigured()) {
    if (localLive.length > 0) {
      console.warn(
        "[poller] live-scores: FOOTBALL_DATA_API_TOKEN not set — live scores unavailable",
      );
    }
    return { polled: false, synced: 0, localLive: localLive.length, configured: false };
  }

  if (localLive.length === 0) {
    clearLiveScores();
    return { polled: false, synced: 0, localLive: 0, configured: true };
  }

  let apiMatches;
  try {
    apiMatches = await fetchLiveWorldCupMatches();
  } catch (err) {
    console.warn("[poller] live-scores:", err instanceof Error ? err.message : err);
    return { polled: true, synced: 0, localLive: localLive.length, configured: true };
  }

  const enriched = await enrichLiveFootballDataMatches(apiMatches, fetchFootballDataMatch);
  const mapped = mapLiveFootballDataToLocal(enriched, localLive);
  for (const row of mapped) {
    upsertLiveScore(row);
  }

  deleteLiveScoresExcept(mapped.map((row) => row.matchId));

  const { recordPollerRun } = await import("@/lib/ops/poller-heartbeat");
  recordPollerRun("live_scores");

  if (mapped.length === 0 && localLive.length > 0) {
    console.warn(
      `[poller] live-scores: ${localLive.length} local live match(es), 0 linked from football-data`,
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
