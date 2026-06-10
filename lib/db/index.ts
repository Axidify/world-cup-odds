import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { runMigrations } from "./migrate";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH ?? "./data/worldcup.db";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _migrated = false;

export function getDb() {
  if (!_migrated) {
    runMigrations();
    _migrated = true;
  }
  if (!_db) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("synchronous = NORMAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

export { schema };
