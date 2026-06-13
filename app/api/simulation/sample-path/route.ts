import { NextResponse } from "next/server";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { buildAdvanceProbsForKnockoutPath } from "@/lib/bracket/knockout-advance-probs";
import { getDb } from "@/lib/db";
import { getConfirmedResults } from "@/lib/sim/actual-results";
import { loadPredictionStore } from "@/lib/sim/prediction-store";
import { clampSampleIndex, randomSampleIndex, runSamplePathAtIndex } from "@/lib/sim/sample-path";
import { getSimulationSeed } from "@/lib/sim/rng";
import { getLatestSimulation } from "@/lib/sim/simulation-cache";
import { getSimulationIterations } from "@/lib/simulator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  getDb();

  const provider = resolveActiveProvider();
  if (!provider) {
    return NextResponse.json({ error: "No LLM provider configured" }, { status: 503 });
  }

  const latest = getLatestSimulation();
  if (!latest) {
    return NextResponse.json({ error: "No simulation cached — run tournament simulation first" }, { status: 404 });
  }

  const iterations = latest.iterations || getSimulationIterations();
  const seed = getSimulationSeed();
  const url = new URL(req.url);
  const rawIndex = url.searchParams.get("index");
  const index =
    rawIndex != null && rawIndex !== ""
      ? clampSampleIndex(Number(rawIndex), iterations)
      : randomSampleIndex(iterations);

  try {
    const store = loadPredictionStore(provider);
    const confirmed = getConfirmedResults();
    const path = runSamplePathAtIndex(store, index, seed, confirmed);
    const championOddsPct = latest.championOdds[path.championTeamId] ?? 0;
    const knockoutAdvanceProbs = buildAdvanceProbsForKnockoutPath(store, path.knockout);

    return NextResponse.json({
      index,
      iterations,
      groupStandings: path.groupStandings,
      knockout: path.knockout,
      championTeamId: path.championTeamId,
      championOddsPct,
      knockoutAdvanceProbs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sample path failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
