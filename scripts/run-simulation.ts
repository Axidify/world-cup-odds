import { loadEnvLocal } from "./load-env";
import { getTeams } from "@/lib/data/load";
import { runTournamentSimulation, TournamentSimulationError } from "@/lib/sim/run-tournament";

loadEnvLocal();

function main() {
  try {
    const result = runTournamentSimulation();
    const teams = new Map(getTeams().map((t) => [t.id, t.name]));
    const top = Object.entries(result.championOdds)
      .map(([id, pct]) => ({ id, name: teams.get(id) ?? id, pct }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 15);

    console.log(JSON.stringify({
      runAt: result.runAt,
      provider: result.provider,
      model: result.model,
      iterations: result.iterations,
      champion: teams.get(result.predictedPath.championTeamId) ?? result.predictedPath.championTeamId,
      championTeamId: result.predictedPath.championTeamId,
      top15: top,
    }, null, 2));
  } catch (err) {
    if (err instanceof TournamentSimulationError) {
      console.error(JSON.stringify({ error: err.message, status: err.status, missingCount: err.missing?.length ?? 0 }, null, 2));
      process.exit(1);
    }
    throw err;
  }
}

main();
