#!/usr/bin/env node
/** Local helper: delete the SQLite DB (same paths as prestart). Restart app after. */
import { existsSync, unlinkSync } from "fs";
import { loadEnvLocal } from "./load-env.ts";

loadEnvLocal();

const dbPath = process.env.DATABASE_PATH ?? "./data/worldcup.db";
let removed = 0;
for (const suffix of ["", "-wal", "-shm"]) {
  const p = dbPath + suffix;
  if (!existsSync(p)) continue;
  unlinkSync(p);
  removed += 1;
  console.log("deleted", p);
}
if (removed === 0) {
  console.log("No database files found at", dbPath);
} else {
  console.log(`Nuked ${removed} file(s). Restart dev/poller to recreate.`);
}
