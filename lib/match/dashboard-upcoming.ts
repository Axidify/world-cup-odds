function utcDayStartMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Kickoff falls on today or tomorrow, UTC calendar days. */
export function isKickoffTodayOrTomorrowUtc(kickoffIso: string, now = Date.now()): boolean {
  const kickoff = new Date(kickoffIso).getTime();
  const startToday = utcDayStartMs(now);
  const endTomorrow = startToday + 2 * 86_400_000;
  return kickoff >= startToday && kickoff < endTomorrow;
}

export function isUpcomingKickoff(kickoffIso: string, now = Date.now()): boolean {
  return new Date(kickoffIso).getTime() > now;
}

export function isDashboardComingUpMatch(kickoffIso: string, now = Date.now()): boolean {
  return isUpcomingKickoff(kickoffIso, now) && isKickoffTodayOrTomorrowUtc(kickoffIso, now);
}
