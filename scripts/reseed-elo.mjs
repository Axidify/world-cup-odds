#!/usr/bin/env node
/** Recompute DB Elo from eloratings.net; optionally reseed predictions + simulation. */
import { loadEnvLocal } from "./load-env.ts";

loadEnvLocal();

const { getDb } = await import("../lib/db/index.ts");
getDb();

const full = process.argv.includes("--full");
const { reseedEloDatabase, reseedPredictionsAndSimulate } = await import(
  "../lib/calibration/reseed-elo.ts"
);

const summary = full ? await reseedPredictionsAndSimulate() : await reseedEloDatabase();
console.log(JSON.stringify(summary, null, 2));
