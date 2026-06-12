import { loadEnvLocal } from "./load-env";

loadEnvLocal();

async function main() {
  const { getDb } = await import("@/lib/db");
  const { predictions } = await import("@/lib/db/schema");
  const { getSimulationStaleState } = await import("@/lib/sim/simulation-cache");
  const { countBulkTargets } = await import("@/lib/ai/preanalyze");
  const { getLatestFetchAt } = await import("@/lib/news/store");

  const db = getDb();
  const rows = db.select().from(predictions).all();
  const stale = rows.filter((r) => r.stale === 1);
  const fresh = rows.filter((r) => r.stale !== 1);

  console.log("Predictions:", rows.length, "fresh:", fresh.length, "stale:", stale.length);
  console.log("Bulk targets:", countBulkTargets());
  console.log("Simulation stale:", getSimulationStaleState());

  const staleTeams = new Map<string, number>();
  for (const r of stale) {
    staleTeams.set(r.teamA, (staleTeams.get(r.teamA) ?? 0) + 1);
    staleTeams.set(r.teamB, (staleTeams.get(r.teamB) ?? 0) + 1);
  }
  const top = [...staleTeams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log("\nTeams in most stale pairings:");
  for (const [team, n] of top) {
    const newsAt = getLatestFetchAt(team);
    console.log(`  ${team}: ${n} pairings, news fetched ${newsAt ?? "never"}`);
  }
}

main();
