import { localCalendarDateKey } from "@/lib/utils/dates";

function nextCalendarDateKey(nowMs: number, timeZone?: string): string {
  const today = localCalendarDateKey(nowMs, timeZone);
  const [y, m, d] = today.split("-").map(Number);
  return localCalendarDateKey(Date.UTC(y, m - 1, d + 1, 12, 0, 0), timeZone);
}

/** Kickoff falls on today or tomorrow in the viewer's local calendar. */
export function isKickoffTodayOrTomorrow(kickoffIso: string, now = Date.now(), timeZone?: string): boolean {
  const kickoffMs = new Date(kickoffIso).getTime();
  const kickoffDay = localCalendarDateKey(kickoffMs, timeZone);
  const today = localCalendarDateKey(now, timeZone);
  const tomorrow = nextCalendarDateKey(now, timeZone);
  return kickoffDay === today || kickoffDay === tomorrow;
}

export function isUpcomingKickoff(kickoffIso: string, now = Date.now()): boolean {
  return new Date(kickoffIso).getTime() > now;
}

export function isDashboardComingUpMatch(kickoffIso: string, now = Date.now()): boolean {
  return isUpcomingKickoff(kickoffIso, now) && isKickoffTodayOrTomorrow(kickoffIso, now);
}
