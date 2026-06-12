import { and, count, desc, eq } from "drizzle-orm";
import type { ChampionOddsMap, PredictedPath, SimulationResult } from "@/lib/types";
import { getDb } from "@/lib/db";
import { predictions, simulationCache } from "@/lib/db/schema";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { countConfirmedSince, getLatestConfirmedAt } from "@/lib/results/confirmed-stats";

function rowToSimulation(row: typeof simulationCache.$inferSelect): SimulationResult {
  return {
    championOdds: JSON.parse(row.championOdds) as ChampionOddsMap,
    predictedPath: JSON.parse(row.predictedPath) as PredictedPath,
    iterations: row.iterations,
    provider: row.provider,
    model: row.model,
    runAt: row.runAt,
  };
}

export function getLatestSimulation(): SimulationResult | null {
  const db = getDb();
  const row = db
    .select()
    .from(simulationCache)
    .orderBy(desc(simulationCache.runAt))
    .limit(1)
    .get();
  if (!row) return null;
  return rowToSimulation(row);
}

/** Prior simulation run — used for before/after champion odds on updates. */
export function getPreviousSimulation(): SimulationResult | null {
  const db = getDb();
  const rows = db
    .select()
    .from(simulationCache)
    .orderBy(desc(simulationCache.runAt))
    .limit(2)
    .all();
  if (rows.length < 2) return null;
  return rowToSimulation(rows[1]);
}

export function saveSimulation(result: SimulationResult): void {
  const db = getDb();
  db.insert(simulationCache)
    .values({
      provider: result.provider,
      model: result.model,
      iterations: result.iterations,
      championOdds: JSON.stringify(result.championOdds),
      predictedPath: JSON.stringify(result.predictedPath),
      runAt: result.runAt,
    })
    .run();
}

function getLatestPredictionAt(provider: string): string | null {
  const db = getDb();
  const row = db
    .select({ generatedAt: predictions.generatedAt })
    .from(predictions)
    .where(and(eq(predictions.provider, provider), eq(predictions.stale, 0)))
    .orderBy(desc(predictions.generatedAt))
    .limit(1)
    .get();
  return row?.generatedAt ?? null;
}

function hasStalePredictions(provider: string): boolean {
  const db = getDb();
  const row = db
    .select({ n: count() })
    .from(predictions)
    .where(and(eq(predictions.provider, provider), eq(predictions.stale, 1)))
    .get();
  return (row?.n ?? 0) > 0;
}

export type SimulationStaleState = {
  stale: boolean;
  providerMismatch: boolean;
  stalePredictionsExist: boolean;
  predictionsNewerThanRun: boolean;
  resultsConfirmedSinceRun: number;
};

export function getSimulationStaleState(): SimulationStaleState {
  const sim = getLatestSimulation();
  if (!sim) {
    return {
      stale: false,
      providerMismatch: false,
      stalePredictionsExist: false,
      predictionsNewerThanRun: false,
      resultsConfirmedSinceRun: 0,
    };
  }

  const provider = resolveActiveProvider();
  const providerMismatch = !provider || sim.provider !== provider;
  const stalePredictionsExist = provider ? hasStalePredictions(provider) : false;
  const latestPred = provider ? getLatestPredictionAt(provider) : null;
  const predictionsNewerThanRun = Boolean(latestPred && latestPred > sim.runAt);
  const resultsConfirmedSinceRun = countConfirmedSince(sim.runAt);

  const stale =
    providerMismatch ||
    stalePredictionsExist ||
    predictionsNewerThanRun ||
    resultsConfirmedSinceRun > 0;

  return {
    stale,
    providerMismatch,
    stalePredictionsExist,
    predictionsNewerThanRun,
    resultsConfirmedSinceRun,
  };
}

/** True when simulation output no longer reflects current predictions or confirmed results. */
export function isSimulationStale(): boolean {
  return getSimulationStaleState().stale;
}

export function needsSimulationRerun(): boolean {
  const state = getSimulationStaleState();
  return (
    state.resultsConfirmedSinceRun > 0 ||
    state.predictionsNewerThanRun ||
    state.providerMismatch
  );
}

export function hasUnconfirmedResultsSinceRun(): boolean {
  const sim = getLatestSimulation();
  if (!sim) return false;
  const latest = getLatestConfirmedAt();
  return Boolean(latest && latest > sim.runAt);
}
