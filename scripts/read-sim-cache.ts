import { loadEnvLocal } from "./load-env";
import { getDb } from "@/lib/db";
import { simulationCache } from "@/lib/db/schema";

loadEnvLocal();
const rows = getDb().select().from(simulationCache).all();
for (const row of rows) {
  const odds = JSON.parse(row.championOdds) as Record<string, number>;
  const keys = Object.keys(odds).length;
  const top = Object.entries(odds).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log({ runAt: row.runAt, iterations: row.iterations, provider: row.provider, oddsKeys: keys, top });
}
