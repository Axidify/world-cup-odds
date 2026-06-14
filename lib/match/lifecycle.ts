import { RESULT_POLL_START_AFTER_MS } from "@/lib/match/poll-timing";
import { formatLocalDateTime } from "@/lib/utils/dates";

export type MatchLifecycle = "upcoming" | "live" | "awaiting_result" | "confirmed";

/** When the poller starts looking for a final score (~2h after kickoff). */
export const MATCH_RESULTS_CHECK_MS = RESULT_POLL_START_AFTER_MS;

export function getMatchLifecycle(
  kickoffIso: string,
  confirmed: boolean,
  now = Date.now(),
): MatchLifecycle {
  if (confirmed) return "confirmed";
  const kickoff = new Date(kickoffIso).getTime();
  if (kickoff > now) return "upcoming";
  if (now < kickoff + MATCH_RESULTS_CHECK_MS) return "live";
  return "awaiting_result";
}

export function getResultsCheckAtMs(kickoffIso: string): number {
  return new Date(kickoffIso).getTime() + MATCH_RESULTS_CHECK_MS;
}

export function formatLifecycleLabel(
  lifecycle: MatchLifecycle,
  kickoffIso: string,
  now = Date.now(),
  liveScore?: { home: number; away: number } | null,
): string {
  switch (lifecycle) {
    case "confirmed":
      return "Full time";
    case "upcoming":
      return `Kickoff ${formatLocalDateTime(kickoffIso)}`;
    case "live":
      return liveScore
        ? `Live · ${liveScore.home}–${liveScore.away}`
        : "Live · in-play score syncing";
    case "awaiting_result":
      return "Awaiting final score";
  }
}

export function formatLifecycleLabelLocal(
  lifecycle: MatchLifecycle,
  kickoffIso: string,
  now = Date.now(),
  timeZone?: string,
  liveScore?: { home: number; away: number } | null,
): string {
  switch (lifecycle) {
    case "confirmed":
      return "Full time";
    case "upcoming":
      return `Kickoff ${formatLocalDateTime(kickoffIso, timeZone)}`;
    case "live":
      return liveScore
        ? `Live · ${liveScore.home}–${liveScore.away}`
        : "Live · in-play score syncing";
    case "awaiting_result":
      return "Awaiting final score";
  }
}

export function formatLifecycleHint(
  lifecycle: MatchLifecycle,
  pollIntervalMinutes: number,
  livePollIntervalSeconds = 60,
): string {
  const liveEvery = formatEveryPollInterval(livePollIntervalSeconds);
  switch (lifecycle) {
    case "confirmed":
      return "Result confirmed — official standings updated.";
    case "upcoming":
      return `After kickoff, in-play scores refresh ${liveEvery}. Full-time results confirm automatically once the match ends.`;
    case "live":
      return `Match in progress — live score updates ${liveEvery} when the live feed is configured.`;
    case "awaiting_result":
      return `Waiting for the confirmed final score (results sync every ${pollIntervalMinutes} min). Odds and bracket refresh after confirm.`;
  }
}

/** Human-readable cadence for live score polling copy, e.g. "every 60 seconds". */
export function formatEveryPollInterval(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s === 1) return "every second";
  if (s < 60) return `every ${s} seconds`;
  if (s === 60) return "every minute";
  if (s % 60 === 0) {
    const minutes = s / 60;
    return minutes === 1 ? "every minute" : `every ${minutes} minutes`;
  }
  return `every ${s} seconds`;
}
