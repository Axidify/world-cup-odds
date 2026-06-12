import { RESULT_POLL_START_AFTER_MS } from "@/lib/match/poll-timing";
import { formatLocalDateTime, formatUtcDateTime } from "@/lib/utils/dates";

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

export function formatCountdown(targetMs: number, now = Date.now()): string {
  const diff = targetMs - now;
  if (diff <= 0) return "soon";
  const totalMins = Math.ceil(diff / 60_000);
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export function formatLifecycleLabel(
  lifecycle: MatchLifecycle,
  kickoffIso: string,
  now = Date.now(),
): string {
  switch (lifecycle) {
    case "confirmed":
      return "Full time";
    case "upcoming":
      return `Kickoff ${formatUtcDateTime(kickoffIso)} UTC`;
    case "live":
      return `Live · score sync in ${formatCountdown(getResultsCheckAtMs(kickoffIso), now)}`;
    case "awaiting_result":
      return "Awaiting final score";
  }
}

export function formatLifecycleLabelLocal(
  lifecycle: MatchLifecycle,
  kickoffIso: string,
  now = Date.now(),
  timeZone?: string,
): string {
  switch (lifecycle) {
    case "confirmed":
      return "Full time";
    case "upcoming":
      return `Kickoff ${formatLocalDateTime(kickoffIso, timeZone)}`;
    case "live":
      return `Live · score sync in ${formatCountdown(getResultsCheckAtMs(kickoffIso), now)}`;
    case "awaiting_result":
      return "Awaiting final score";
  }
}

export function formatLifecycleHint(
  lifecycle: MatchLifecycle,
  pollIntervalMinutes: number,
): string {
  switch (lifecycle) {
    case "confirmed":
      return "Result confirmed — official standings updated.";
    case "upcoming":
      return `Scores usually appear ~2 hours after kickoff, then the poller syncs every ${pollIntervalMinutes} minutes.`;
    case "live":
      return "Match in progress. We start checking for the final score about 2 hours after kickoff.";
    case "awaiting_result":
      return `Poller is searching for the score (every ${pollIntervalMinutes} min when matches need results). Projected tables re-sim after confirm.`;
  }
}
