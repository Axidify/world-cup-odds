export type LiveMinuteSource = {
  minute: string | null;
  status?: string | null;
};

/** Display label for in-play clock (e.g. 52, 45+2, HT, ~38). */
export function formatLiveMinuteDisplay(
  live: LiveMinuteSource | null | undefined,
  kickoffIso: string,
  now = Date.now(),
): string | null {
  if (live?.minute) {
    return live.minute === "HT" ? "HT" : `${live.minute}'`;
  }
  if (live?.status === "PAUSED") return "HT";
  if (!live) return null;

  const kickoff = new Date(kickoffIso).getTime();
  const elapsedMin = Math.floor((now - kickoff) / 60_000);
  if (elapsedMin < 1 || elapsedMin > 120) return null;
  return `~${elapsedMin}'`;
}
