import { NextResponse } from "next/server";
import { getSimulationStaleState, getLatestSimulation } from "@/lib/sim/simulation-cache";
import { formatSimulationStaleMessage } from "@/lib/sim/stale-messages";
import { getPendingResults } from "@/lib/results/store";
import { getPollerStatus } from "@/lib/ops/poller-heartbeat";
import { getPipelineConfig } from "@/lib/pipeline/config";
import { isPipelineActive } from "@/lib/pipeline/auto-pipeline";
import { getPipelineState } from "@/lib/pipeline/pipeline-state";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  getDb();
  const simulation = getLatestSimulation();
  const staleState = getSimulationStaleState();
  const pending = getPendingResults();
  const poller = getPollerStatus();

  return NextResponse.json({
    simulation: simulation
      ? { runAt: simulation.runAt, provider: simulation.provider, model: simulation.model }
      : null,
    stale: staleState,
    staleMessage: formatSimulationStaleMessage(staleState),
    pendingResults: pending.length,
    poller,
    pipeline: {
      config: getPipelineConfig(),
      state: getPipelineState(),
      active: isPipelineActive(),
    },
  });
}
