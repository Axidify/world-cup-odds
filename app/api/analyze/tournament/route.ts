import { NextResponse } from "next/server";
import { z } from "zod";
import { isBulkJobRunning } from "@/lib/ai/bulk-job";
import { runTournamentSimulation, TournamentSimulationError } from "@/lib/sim/run-tournament";
import { tryAcquireTournamentLock, releaseTournamentLock } from "@/lib/sim/tournament-lock";
import { getDb } from "@/lib/db";
import { isAdminConfigured, verifyAdminPin } from "@/lib/utils/admin";

const bodySchema = z.object({
  pin: z.string().optional(),
});

export async function POST(request: Request) {
  getDb();

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "ADMIN_PIN is not configured" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || !verifyAdminPin(parsed.data.pin)) {
    return NextResponse.json({ error: "Invalid or missing ADMIN_PIN" }, { status: 401 });
  }

  if (isBulkJobRunning()) {
    return NextResponse.json(
      { error: "Bulk analyze is running — wait for it to finish before simulating" },
      { status: 429 },
    );
  }

  if (!tryAcquireTournamentLock()) {
    return NextResponse.json(
      { error: "A tournament simulation is already running." },
      { status: 429 },
    );
  }

  try {
    const result = runTournamentSimulation();
    return NextResponse.json({
      championOdds: result.championOdds,
      predictedPath: result.predictedPath,
      iterations: result.iterations,
      provider: result.provider,
      model: result.model,
      runAt: result.runAt,
    });
  } catch (err) {
    if (err instanceof TournamentSimulationError) {
      return NextResponse.json(
        { error: err.message, missing: err.missing ?? [] },
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    releaseTournamentLock();
  }
}
