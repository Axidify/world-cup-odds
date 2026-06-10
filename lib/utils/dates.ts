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
