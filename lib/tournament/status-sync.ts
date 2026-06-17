export type SimulationSnapshot = {
  runAt: string | null;
};

/** True when a new simulation finished since the last client snapshot. */
export function shouldRefreshForSimulation(
  previous: SimulationSnapshot | null,
  next: SimulationSnapshot,
): boolean {
  if (previous === null) return false;
  if (previous.runAt === next.runAt) return false;
  return true;
}
