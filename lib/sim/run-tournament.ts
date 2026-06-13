import { getModelForProvider } from "@/lib/ai/config";
import { resolveActiveProvider } from "@/lib/ai/settings";
import type { MissingPairing, SimulationResult } from "@/lib/types";
import {
  buildRepresentativePredictedPath,
  buildSimulationExtras,
  championOddsLeader,
  getSimulationIterations,
  normalizeChampionOdds,
  runMonteCarlo,
  runMonteCarloBundle,
} from "@/lib/simulator";
import { getSimulationSeed } from "@/lib/sim/rng";
import { getConfirmedResults } from "@/lib/sim/actual-results";
import { collectMissingPairings } from "@/lib/sim/gap-analysis";
import { loadPredictionStore, MissingPredictionError } from "@/lib/sim/prediction-store";
import { saveSimulation } from "@/lib/sim/simulation-cache";
import { getResolvedMatches } from "@/lib/data/resolved";

export class TournamentSimulationError extends Error {
  constructor(
    message: string,
    public status: number,
    public missing?: MissingPairing[],
  ) {
    super(message);
    this.name = "TournamentSimulationError";
  }
}

function mergeConfirmedResults(): Map<string, import("@/lib/types").PlayedMatchResult> {
  const raw = getConfirmedResults();
  const byId = new Map(getResolvedMatches().map((m) => [m.id, m]));
  const merged = new Map<string, import("@/lib/types").PlayedMatchResult>();
  for (const [matchId, row] of raw) {
    const fx = byId.get(matchId);
    if (!fx || fx.homeTeamId === "TBD" || fx.awayTeamId === "TBD") continue;
    merged.set(matchId, {
      ...row,
      homeTeamId: fx.homeTeamId,
      awayTeamId: fx.awayTeamId,
      winnerTeamId:
        row.winnerTeamId ??
        (row.homeGoals > row.awayGoals
          ? fx.homeTeamId
          : row.awayGoals > row.homeGoals
            ? fx.awayTeamId
            : undefined),
    });
  }
  return merged;
}

export function runTournamentSimulation(): SimulationResult {
  const provider = resolveActiveProvider();
  if (!provider) {
    throw new TournamentSimulationError(
      "No LLM provider configured. Add credentials to .env.local",
      503,
    );
  }

  const store = loadPredictionStore(provider);
  const storeBase = loadPredictionStore(provider, { applyNewsImpact: false });
  const confirmed = mergeConfirmedResults();
  const missing = collectMissingPairings(store, provider, confirmed);
  if (missing.length > 0) {
    throw new TournamentSimulationError(
      `Missing ${missing.length} prediction(s). Analyze matches first.`,
      422,
      missing,
    );
  }

  try {
    const iterations = getSimulationIterations();
    const seed = getSimulationSeed();
    const bundle = runMonteCarloBundle(store, iterations, seed, confirmed);
    const championOdds = normalizeChampionOdds(bundle.championOdds);
    const championOddsBase = normalizeChampionOdds(
      runMonteCarlo(storeBase, iterations, seed + 1_000_000, confirmed),
    );
    const leader = championOddsLeader(championOdds);
    const predictedPath = buildRepresentativePredictedPath(
      store,
      championOdds,
      confirmed,
      iterations,
      seed,
    );
    const result: SimulationResult = {
      championOdds,
      predictedPath,
      iterations,
      provider,
      model: getModelForProvider(provider),
      runAt: new Date().toISOString(),
      extras: buildSimulationExtras(
        championOdds,
        championOddsBase,
        bundle.survivalOdds,
        bundle.modalGroupStandings,
        iterations,
        leader,
      ),
    };
    saveSimulation(result);
    return result;
  } catch (err) {
    if (err instanceof MissingPredictionError) {
      throw new TournamentSimulationError(
        `Missing ${err.missing.length} prediction(s). Analyze matches first.`,
        422,
        err.missing,
      );
    }
    throw err;
  }
}
