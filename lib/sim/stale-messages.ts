import type { SimulationStaleState } from "@/lib/sim/simulation-cache";

export function formatSimulationStaleMessage(state: SimulationStaleState): string | null {
  if (!state.stale) return null;

  if (state.providerMismatch) {
    return "LLM provider changed since last simulation — re-analyze and re-run simulation.";
  }

  if (state.resultsConfirmedSinceRun > 0 && !state.stalePredictionsExist && !state.predictionsNewerThanRun) {
    const n = state.resultsConfirmedSinceRun;
    return `${n} result${n === 1 ? "" : "s"} confirmed since last simulation — re-run simulation to refresh odds and bracket.`;
  }

  if (state.stalePredictionsExist) {
    return "Some predictions still need LLM analysis — use Analyze missing below, then re-run simulation.";
  }

  if (state.predictionsNewerThanRun) {
    if (state.resultsConfirmedSinceRun > 0) {
      return "New predictions and confirmed results — re-run simulation to refresh odds and bracket.";
    }
    return "Predictions updated since last simulation — re-run simulation to refresh odds and bracket.";
  }

  if (state.resultsConfirmedSinceRun > 0) {
    const n = state.resultsConfirmedSinceRun;
    return `${n} result${n === 1 ? "" : "s"} confirmed since last simulation — re-run simulation.`;
  }

  return "Simulation is out of date — re-run simulation.";
}
