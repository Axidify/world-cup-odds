import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const predictions = sqliteTable(
  "predictions",
  {
    cacheKey: text("cache_key").primaryKey(),
    teamA: text("team_a").notNull(),
    teamB: text("team_b").notNull(),
    stage: text("stage").notNull(),
    isNeutral: integer("is_neutral").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    homeWinPct: real("home_win_pct").notNull(),
    drawPct: real("draw_pct").notNull(),
    awayWinPct: real("away_win_pct").notNull(),
    predictedScore: text("predicted_score"),
    keyFactors: text("key_factors"),
    analysis: text("analysis"),
    isCalibrated: integer("is_calibrated").default(0),
    stale: integer("stale").default(0),
    generatedAt: text("generated_at").notNull(),
  },
  (t) => [
    index("idx_predictions_teams").on(t.teamA, t.teamB),
    index("idx_predictions_stale").on(t.stale),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const simulationCache = sqliteTable("simulation_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  iterations: integer("iterations").notNull(),
  championOdds: text("champion_odds").notNull(),
  predictedPath: text("predicted_path").notNull(),
  extras: text("extras"),
  runAt: text("run_at").notNull(),
});

export const teamEvents = sqliteTable("team_events", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  type: text("type").notNull(),
  player: text("player"),
  detail: text("detail"),
  source: text("source"),
  severity: text("severity"),
  keyPlayer: integer("key_player").default(0),
  fetchedAt: text("fetched_at").notNull(),
});

export const newsCache = sqliteTable("news_cache", {
  queryHash: text("query_hash").primaryKey(),
  snippets: text("snippets"),
  summary: text("summary"),
  fetchedAt: text("fetched_at").notNull(),
});

export const actualResults = sqliteTable("actual_results", {
  matchId: text("match_id").primaryKey(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  et: integer("et").default(0),
  pens: integer("pens").default(0),
  winnerTeamId: text("winner_team_id"),
  confirmed: integer("confirmed").default(0),
  source: text("source"),
  syncedAt: text("synced_at"),
  confirmedAt: text("confirmed_at"),
  confirmedBy: text("confirmed_by"),
});

export const eloRatings = sqliteTable("elo_ratings", {
  teamId: text("team_id").primaryKey(),
  rating: real("rating").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const calibrationState = sqliteTable("calibration_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const predictionLog = sqliteTable("prediction_log", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  cacheKey: text("cache_key"),
  predicted: text("predicted").notNull(),
  actual: text("actual").notNull(),
  brier: real("brier"),
  logLoss: real("log_loss"),
  createdAt: text("created_at").notNull(),
});

export const bettors = sqliteTable("bettors", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const bets = sqliteTable(
  "bets",
  {
    id: text("id").primaryKey(),
    bettorId: text("bettor_id")
      .notNull()
      .references(() => bettors.id),
    betType: text("bet_type").notNull(),
    matchId: text("match_id"),
    selection: text("selection").notNull(),
    stakeMyr: real("stake_myr").notNull(),
    decimalOdds: real("decimal_odds").notNull(),
    potentialPayoutMyr: real("potential_payout_myr").notNull(),
    probabilityAtBet: real("probability_at_bet").notNull(),
    status: text("status").notNull(),
    payoutMyr: real("payout_myr"),
    placedAt: text("placed_at").notNull(),
    settledAt: text("settled_at"),
  },
  (t) => [
    index("idx_bets_status").on(t.status),
    index("idx_bets_bettor").on(t.bettorId),
  ],
);
