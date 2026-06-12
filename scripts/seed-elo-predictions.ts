/**
 * Seed group-stage predictions from World Football Elo (no LLM).
 * Useful when vLLM is down or to demo the simulation pipeline.
 */
import { loadEnvLocal } from "./load-env";
import { getModelForProvider } from "@/lib/ai/config";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { seedAllGroupFixturesFromElo } from "@/lib/calibration/seed-elo-predictions";

loadEnvLocal();

const provider = resolveActiveProvider();
if (!provider) {
  console.error("No LLM_PROVIDER set");
  process.exit(1);
}

const model = getModelForProvider(provider);
const seeded = seedAllGroupFixturesFromElo(provider, model);
console.log(JSON.stringify({ seeded, provider, model }, null, 2));
