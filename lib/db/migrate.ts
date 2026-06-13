import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_PATH ?? "./data/worldcup.db";

export function runMigrations() {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      cache_key TEXT PRIMARY KEY,
      team_a TEXT NOT NULL,
      team_b TEXT NOT NULL,
      stage TEXT NOT NULL,
      is_neutral INTEGER NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      home_win_pct REAL NOT NULL,
      draw_pct REAL NOT NULL,
      away_win_pct REAL NOT NULL,
      predicted_score TEXT,
      key_factors TEXT,
      analysis TEXT,
      is_calibrated INTEGER DEFAULT 0,
      stale INTEGER DEFAULT 0,
      generated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_predictions_teams ON predictions(team_a, team_b);
    CREATE INDEX IF NOT EXISTS idx_predictions_stale ON predictions(stale);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS simulation_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      champion_odds TEXT NOT NULL,
      predicted_path TEXT NOT NULL,
      run_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_events (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      type TEXT NOT NULL,
      player TEXT,
      detail TEXT,
      source TEXT,
      severity TEXT,
      key_player INTEGER DEFAULT 0,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news_cache (
      query_hash TEXT PRIMARY KEY,
      snippets TEXT,
      summary TEXT,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actual_results (
      match_id TEXT PRIMARY KEY,
      home_score INTEGER,
      away_score INTEGER,
      et INTEGER DEFAULT 0,
      pens INTEGER DEFAULT 0,
      winner_team_id TEXT,
      confirmed INTEGER DEFAULT 0,
      source TEXT,
      synced_at TEXT,
      confirmed_at TEXT,
      confirmed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS elo_ratings (
      team_id TEXT PRIMARY KEY,
      rating REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calibration_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prediction_log (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      cache_key TEXT,
      predicted TEXT NOT NULL,
      actual TEXT NOT NULL,
      brier REAL,
      log_loss REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bettors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bets (
      id TEXT PRIMARY KEY,
      bettor_id TEXT NOT NULL REFERENCES bettors(id),
      bet_type TEXT NOT NULL,
      match_id TEXT,
      selection TEXT NOT NULL,
      stake_myr REAL NOT NULL,
      decimal_odds REAL NOT NULL,
      potential_payout_myr REAL NOT NULL,
      probability_at_bet REAL NOT NULL,
      status TEXT NOT NULL,
      payout_myr REAL,
      placed_at TEXT NOT NULL,
      settled_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
    CREATE INDEX IF NOT EXISTS idx_bets_bettor ON bets(bettor_id);

    CREATE TABLE IF NOT EXISTS live_scores (
      match_id TEXT PRIMARY KEY,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      status TEXT,
      minute TEXT,
      synced_at TEXT NOT NULL
    );
  `);

  ensureColumn(db, "team_events", "severity", "severity TEXT");
  ensureColumn(db, "team_events", "key_player", "key_player INTEGER DEFAULT 0");
  ensureColumn(db, "simulation_cache", "extras", "extras TEXT");

  db.close();
}

function ensureColumn(db: Database.Database, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
