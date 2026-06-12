#!/usr/bin/env node
/**
 * Refresh data/world-football-elo.json from World Football Elo Ratings.
 * Source: https://www.eloratings.net/World.tsv
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const { fetchWorldFootballEloRatings } = await import(
  "../lib/calibration/fetch-world-football-elo.ts"
);

const out = await fetchWorldFootballEloRatings();
const path = join(root, "data/world-football-elo.json");
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `Wrote ${Object.keys(out.ratings).length} ratings (as of ${out.asOf}) → ${path}`,
);
