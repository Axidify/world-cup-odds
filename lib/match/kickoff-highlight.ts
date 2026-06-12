import type { MatchLifecycle } from "@/lib/match/lifecycle";
import { localCalendarDateKey } from "@/lib/utils/dates";

export type KickoffHighlight = "live" | "later_today" | "tomorrow" | null;

export function getKickoffHighlight(
  kickoffIso: string,
  lifecycle: MatchLifecycle,
  now = Date.now(),
  timeZone?: string,
): KickoffHighlight {
  if (lifecycle === "live" || lifecycle === "awaiting_result") return "live";
  if (lifecycle === "confirmed") return null;

  const kickoffMs = new Date(kickoffIso).getTime();
  if (kickoffMs <= now) return "live";

  const tz = timeZone ?? resolveLocalTimeZone();
  const kickoffDay = localCalendarDateKey(kickoffMs, tz);
  const today = localCalendarDateKey(now, tz);
  const tomorrow = nextCalendarDateKey(now, tz);

  if (kickoffDay === today) return "later_today";
  if (kickoffDay === tomorrow) return "tomorrow";
  return null;
}

export function kickoffHighlightRowClass(highlight: KickoffHighlight): string {
  switch (highlight) {
    case "live":
      return "rounded-md ring-1 ring-loss/45 bg-loss/5";
    case "later_today":
      return "rounded-md ring-1 ring-brand/45 bg-brand-tint/25";
    case "tomorrow":
      return "rounded-md ring-1 ring-border bg-surface-2/60";
    default:
      return "";
  }
}

export function kickoffHighlightCardClass(highlight: KickoffHighlight): string {
  switch (highlight) {
    case "live":
      return "border-loss/45 bg-loss/5";
    case "later_today":
      return "border-brand/45 bg-brand-tint/20";
    case "tomorrow":
      return "border-border bg-surface-2/50";
    default:
      return "";
  }
}

export function kickoffHighlightLabel(highlight: KickoffHighlight): string | null {
  switch (highlight) {
    case "live":
      return "Live";
    case "later_today":
      return "Today";
    case "tomorrow":
      return "Tomorrow";
    default:
      return null;
  }
}

function nextCalendarDateKey(nowMs: number, timeZone?: string): string {
  const today = localCalendarDateKey(nowMs, timeZone);
  const [y, m, d] = today.split("-").map(Number);
  return localCalendarDateKey(Date.UTC(y, m - 1, d + 1, 12, 0, 0), timeZone);
}

function resolveLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
