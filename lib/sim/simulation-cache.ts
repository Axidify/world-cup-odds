import { and, count, desc, eq } from "drizzle-orm";
import type { ChampionOddsMap, PredictedPath, SimulationResult } from "@/lib/types";
import { getDb } from "@/lib/db";
import { predictions, simulationCache } from "@/lib/db/schema";
import { resolveActiveProvider } from "@/lib/ai/settings";

export function getLatestSimulation(): SimulationResult | null {
  const db = getDb();
  const row = db
    .select()
    .from(simulationCache)
    .orderBy(desc(simulationCache.runAt))
    .limit(1)
    .get();
  if (!row) return null;
  return {
    championOdds: JSON.parse(row.championOdds) as ChampionOddsMap,
    predictedPath: JSON.parse(row.predictedPath) as PredictedPath,
    iterations: row.iterations,
    provider: row.provider,
    model: row.model,
    runAt: row.runAt,
  };
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

/** True when predictions for the active provider are newer than the last simulation run. */
export function isSimulationStale(): boolean {
  const sim = getLatestSimulation();
  if (!sim) return false;
  const provider = resolveActiveProvider();
  if (!provider || sim.provider !== provider) return true;
  if (hasStalePredictions(provider)) return true;
  const latestPred = getLatestPredictionAt(provider);
  if (!latestPred) return false;
  return latestPred > sim.runAt;
}
