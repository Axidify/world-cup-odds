import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { liveScores } from "@/lib/db/schema";
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

export function getLiveScore(matchId: string): LiveScoreRow | null {
  const db = getDb();
  const row = db.select().from(liveScores).where(eq(liveScores.matchId, matchId)).get();
  return row ? rowToLiveScore(row) : null;
}

export function listLiveScores(): LiveScoreRow[] {
  const db = getDb();
  return db.select().from(liveScores).all().map(rowToLiveScore);
}

/** Drop live rows no longer in the feed, but keep snapshots until the result is confirmed. */
export function pruneLiveScores(currentlyLiveMatchIds: string[]): void {
  const db = getDb();
  const keep = new Set(currentlyLiveMatchIds);
  const rows = db.select({ matchId: liveScores.matchId }).from(liveScores).all();

  const remove = rows
    .map((row) => row.matchId)
    .filter((matchId) => {
      if (keep.has(matchId)) return false;
      return getResult(matchId)?.confirmed === true;
    });

  if (remove.length === 0) return;
  db.delete(liveScores).where(inArray(liveScores.matchId, remove)).run();
}

export function deleteLiveScoresExcept(matchIds: string[]): void {
  pruneLiveScores(matchIds);
}

export function clearLiveScores(): void {
  pruneLiveScores([]);
}
