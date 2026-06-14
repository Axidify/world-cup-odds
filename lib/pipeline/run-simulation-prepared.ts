import { isBulkJobRunning } from "@/lib/ai/bulk-job";
import { runTournamentSimulation, TournamentSimulationError } from "@/lib/sim/run-tournament";
import { tryAcquireTournamentLock, releaseTournamentLock } from "@/lib/sim/tournament-lock";
import { ensureStaleQueueClearedBeforeSim, waitForBulkJobCompletion } from "@/lib/pipeline/stale-before-sim";

export class SimulationPreparationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Shared path for manual and auto simulation — clears stale predictions first. */
export async function runTournamentSimulationPrepared(): Promise<
  ReturnType<typeof runTournamentSimulation>
> {
  if (isBulkJobRunning()) {
    await waitForBulkJobCompletion();
  }

  const staleCleared = await ensureStaleQueueClearedBeforeSim("manual_sim");
  if (!staleCleared) {
    throw new SimulationPreparationError(
      "Stale predictions remain — finish or retry bulk analyze, then simulate again",
      409,
    );
  }

  if (!tryAcquireTournamentLock()) {
    throw new SimulationPreparationError("A tournament simulation is already running.", 429);
  }

  try {
    return runTournamentSimulation();
  } finally {
    releaseTournamentLock();
  }
}

export { TournamentSimulationError };
