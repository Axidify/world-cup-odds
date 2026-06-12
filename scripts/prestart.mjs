#!/usr/bin/env node
/** Runs before app + poller. Deletes SQLite when NUKE_DATABASE_ON_START=1. */
import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function nukeDatabaseIfRequested() {
  const flag = process.env.NUKE_DATABASE_ON_START;
  if (flag !== "1" && flag !== "true") return;

  const dbPath = process.env.DATABASE_PATH ?? "./data/worldcup.db";
  let removed = 0;
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = dbPath + suffix;
    if (!existsSync(p)) continue;
    unlinkSync(p);
    removed += 1;
    console.log("[prestart] deleted", p);
  }
  console.log(`[prestart] Database nuked (${removed} file(s)) — migrations recreate on boot`);
}

loadEnvLocal();
nukeDatabaseIfRequested();
