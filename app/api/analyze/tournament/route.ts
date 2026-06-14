import { NextResponse } from "next/server";
import { z } from "zod";
import {
  runTournamentSimulationPrepared,
  SimulationPreparationError,
  TournamentSimulationError,
} from "@/lib/pipeline/run-simulation-prepared";
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

  try {
    const result = await runTournamentSimulationPrepared();
    return NextResponse.json({
      championOdds: result.championOdds,
      predictedPath: result.predictedPath,
      iterations: result.iterations,
      provider: result.provider,
      model: result.model,
      runAt: result.runAt,
    });
  } catch (err) {
    if (err instanceof SimulationPreparationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof TournamentSimulationError) {
      return NextResponse.json(
        { error: err.message, missing: err.missing ?? [] },
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
