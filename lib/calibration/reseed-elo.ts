import { getModelForProvider } from "@/lib/ai/config";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { recomputeEloFromConfirmedResults, getEloRating } from "@/lib/calibration/elo";
import { refreshWorldFootballEloLive } from "@/lib/calibration/refresh-world-football-elo";
import {
  seedAllGroupFixturesFromElo,
  seedMissingPairingsFromElo,
} from "@/lib/calibration/seed-elo-predictions";
import { collectMissingPairings } from "@/lib/sim/gap-analysis";
import { loadPredictionStore } from "@/lib/sim/prediction-store";
import { runTournamentSimulation } from "@/lib/sim/run-tournament";

export type ReseedSummary = {
  eloRefreshedAsOf: string;
  sampleElo: { mex: number | null; arg: number | null };
  groupPredictionsSeeded: number;
  knockoutGapsSeeded: number;
  simulationRunAt: string | null;
};

/** Reset DB Elo from eloratings.net and replay confirmed WC results. */
export async function reseedEloDatabase(): Promise<{ asOf: string }> {
  const refreshed = await refreshWorldFootballEloLive();
  recomputeEloFromConfirmedResults();
  return { asOf: refreshed.asOf };
}

/** Overwrite group preds from Elo, fill knockout gaps, run simulation. */
export async function reseedPredictionsAndSimulate(): Promise<ReseedSummary> {
  const { asOf } = await reseedEloDatabase();

  const provider = resolveActiveProvider();
  if (!provider) {
    throw new Error("No LLM_PROVIDER configured — needed to tag prediction cache rows");
  }

  const model = getModelForProvider(provider);
  const groupPredictionsSeeded = seedAllGroupFixturesFromElo(provider, model);

  const store = loadPredictionStore(provider);
  const missing = collectMissingPairings(store, provider);
  const knockoutGapsSeeded = missing.length
    ? seedMissingPairingsFromElo(missing, provider, model)
    : 0;

  let simulationRunAt: string | null = null;
  try {
    const sim = runTournamentSimulation();
    simulationRunAt = sim.runAt;
  } catch {
    simulationRunAt = null;
  }

  return {
    eloRefreshedAsOf: asOf,
    sampleElo: {
      mex: getEloRating("mex"),
      arg: getEloRating("arg"),
    },
    groupPredictionsSeeded,
    knockoutGapsSeeded,
    simulationRunAt,
  };
}
