import { getResolvedMatches } from "@/lib/data/resolved";
import { getResult } from "@/lib/results/store";
import { getMatchesNeedingResults, RESULT_POLL_START_AFTER_MS } from "@/lib/jobs/poll-results";

const MIN_IDLE_DELAY_MS = 60_000;
const NO_SCHEDULE_DELAY_MS = 24 * 60 * 60 * 1000;

export type ResultsPollPlan = {
  shouldPoll: boolean;
  delayMs: number;
  nextPollAt: number;
  reason: string;
};

/** When the next unconfirmed match becomes eligible for results polling. */
export function getNextResultsPollWindow(now = Date.now()): number | null {
  let next: number | null = null;

  for (const match of getResolvedMatches()) {
    if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") continue;
    if (getResult(match.id)?.confirmed) continue;

    const pollStart = new Date(match.date).getTime() + RESULT_POLL_START_AFTER_MS;
    if (pollStart <= now) continue;

    next = next == null ? pollStart : Math.min(next, pollStart);
  }

  return next;
}

export function getResultsPollPlan(
  activeIntervalMs: number,
  now = Date.now(),
): ResultsPollPlan {
  const targets = getMatchesNeedingResults();
  const safeInterval = Math.max(activeIntervalMs, MIN_IDLE_DELAY_MS);

  if (targets.length > 0) {
    return {
      shouldPoll: true,
      delayMs: safeInterval,
      nextPollAt: now + safeInterval,
      reason: `${targets.length} match${targets.length === 1 ? "" : "es"} awaiting results`,
    };
  }

  const nextWindow = getNextResultsPollWindow(now);
  if (nextWindow != null) {
    const delayMs = Math.max(MIN_IDLE_DELAY_MS, nextWindow - now);
    return {
      shouldPoll: false,
      delayMs,
      nextPollAt: now + delayMs,
      reason: `next results window ${new Date(nextWindow).toISOString()} UTC`,
    };
  }

  return {
    shouldPoll: false,
    delayMs: NO_SCHEDULE_DELAY_MS,
    nextPollAt: now + NO_SCHEDULE_DELAY_MS,
    reason: "no upcoming matches on schedule",
  };
}
