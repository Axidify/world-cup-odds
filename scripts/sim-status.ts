import { loadEnvLocal } from "./load-env";
import { getTeams } from "@/lib/data/load";
import { getLatestSimulation } from "@/lib/sim/simulation-cache";
import { countPredictions } from "@/lib/ai/predictions";
import { countBulkTargets } from "@/lib/ai/preanalyze";
import { resolveActiveProvider } from "@/lib/ai/settings";

loadEnvLocal();

const sim = getLatestSimulation();
const provider = resolveActiveProvider();
const targets = countBulkTargets(false);

console.log(JSON.stringify({
  provider,
  predictions: countPredictions({ provider, nonStale: true }),
  bulkTargets: targets,
  hasSimulation: Boolean(sim),
  lastRun: sim?.runAt ?? null,
  iterations: sim?.iterations ?? null,
}, null, 2));

if (sim) {
  const teams = new Map(getTeams().map((t) => [t.id, t.name]));
  const top = Object.entries(sim.championOdds)
    .map(([id, pct]) => ({ name: teams.get(id) ?? id, pct: Math.round(pct * 100) / 100 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 15);
  console.log("\nTop 15 champion % (cached):");
  for (const row of top) console.log(`  ${row.pct.toFixed(2)}%  ${row.name}`);
  console.log(
    `\nProjected champion: ${teams.get(sim.predictedPath.championTeamId) ?? sim.predictedPath.championTeamId}`,
  );
}
