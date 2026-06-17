export type ConfirmedResultsSnapshot = {
  count: number;
  latestConfirmedAt: string | null;
};

/** True when server-side confirmed results changed since the last client snapshot. */
export function shouldRefreshForConfirmedResults(
  previous: ConfirmedResultsSnapshot | null,
  next: ConfirmedResultsSnapshot,
): boolean {
  if (previous === null) return false;
  return (
    previous.count !== next.count ||
    previous.latestConfirmedAt !== next.latestConfirmedAt
  );
}
