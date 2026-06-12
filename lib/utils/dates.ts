export function formatUtcDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    ...options,
    timeZone: "UTC",
  });
}

export function formatUtcDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

/** Calendar day in local (or explicit) timezone — `en-CA` yields YYYY-MM-DD. */
export function localCalendarDateKey(ms: number, timeZone?: string): string {
  return new Date(ms).toLocaleDateString("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatLocalDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
  timeZone?: string,
): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    ...options,
    timeZone,
  });
}

export function formatLocalTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatLocalDateTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
}

export function getLocalTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function formatUpcomingKickoffCompact(
  kickoffIso: string,
  highlight: "later_today" | "tomorrow" | null,
  timeZone?: string,
): string {
  const time = formatLocalTime(kickoffIso, timeZone);
  if (highlight === "later_today") return `Today ${time}`;
  if (highlight === "tomorrow") return `Tomorrow ${time}`;
  return `${formatLocalDate(kickoffIso, { day: "numeric", month: "short" }, timeZone)} ${time}`;
}
