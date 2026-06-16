import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { liveScores } from "@/lib/db/schema";
import { isLiveFootballDataStatus } from "@/lib/results/football-data/client";
import { getResult } from "@/lib/results/store";

export type LiveScoreRow = {
  matchId: string;
  homeScore: number;
  awayScore: number;
  status: string | null;
  minute: string | null;
  syncedAt: string;
};

function rowToLiveScore(row: typeof liveScores.$inferSelect): LiveScoreRow {
  return {
    matchId: row.matchId,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    status: row.status,
    minute: row.minute,
    syncedAt: row.syncedAt,
  };
}

export function upsertLiveScore(input: {
  matchId: string;
  homeScore: number;
  awayScore: number;
  status?: string | null;
  minute?: string | number | null;
}): LiveScoreRow {
  const db = getDb();
  const now = new Date().toISOString();
  const minute =
    input.minute == null || input.minute === ""
      ? null
      : String(input.minute);

  db.insert(liveScores)
    .values({
      matchId: input.matchId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      status: input.status ?? null,
      minute,
      syncedAt: now,
    })
    .onConflictDoUpdate({
      target: liveScores.matchId,
      set: {
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        status: input.status ?? null,
        minute,
        syncedAt: now,
      },
    })
    .run();

  return getLiveScore(input.matchId)!;
}

export function deleteLiveScore(matchId: string): boolean {
  const db = getDb();
  const changes = db.delete(liveScores).where(eq(liveScores.matchId, matchId)).run().changes;
  return changes > 0;
}

export function getLiveScore(matchId: string): LiveScoreRow | null {
  const db = getDb();
  const row = db.select().from(liveScores).where(eq(liveScores.matchId, matchId)).get();
  return row ? rowToLiveScore(row) : null;
}

export function listLiveScores(): LiveScoreRow[] {
  const db = getDb();
  return db.select().from(liveScores).all().map(rowToLiveScore);
}

/** Drop rows no longer tracked live; keep finished snapshots until confirm when useful. */
export function pruneLiveScores(currentlyLiveMatchIds: string[]): void {
  const db = getDb();
  const keep = new Set(currentlyLiveMatchIds);
  const rows = db.select().from(liveScores).all();

  const remove = rows
    .filter((row) => {
      if (keep.has(row.matchId)) return false;
      if (getResult(row.matchId)?.confirmed === true) return true;
      return isLiveFootballDataStatus(row.status ?? undefined);
    })
    .map((row) => row.matchId);

  if (remove.length === 0) return;
  db.delete(liveScores).where(inArray(liveScores.matchId, remove)).run();
}

export function deleteLiveScoresExcept(matchIds: string[]): void {
  pruneLiveScores(matchIds);
}

export function clearLiveScores(): void {
  pruneLiveScores([]);
}
