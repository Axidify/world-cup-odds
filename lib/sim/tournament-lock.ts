let running = false;

export function tryAcquireTournamentLock(): boolean {
  if (running) return false;
  running = true;
  return true;
}

export function releaseTournamentLock(): void {
  running = false;
}
