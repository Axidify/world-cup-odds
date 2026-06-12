import { eq } from "drizzle-orm";
import type { Match } from "@/lib/types";
import { getTeamMap } from "@/lib/data/load";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getDb } from "@/lib/db";
import { actualResults } from "@/lib/db/schema";

export type ResultRow = {
  matchId: string;
  homeScore: number | null;
  awayScore: number | null;
  et: boolean;
  pens: boolean;
  winnerTeamId: string | null;
  confirmed: boolean;
  source: string | null;
  syncedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
};

export type PendingResultView = ResultRow & {
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  stage: string;
  date: string;
};

function rowToResult(row: typeof actualResults.$inferSelect): ResultRow {
  return {
    matchId: row.matchId,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    et: row.et === 1,
    pens: row.pens === 1,
    winnerTeamId: row.winnerTeamId,
    confirmed: row.confirmed === 1,
    source: row.source,
    syncedAt: row.syncedAt,
    confirmedAt: row.confirmedAt,
    confirmedBy: row.confirmedBy,
  };
}

export function getResult(matchId: string): ResultRow | null {
  const db = getDb();
  const row = db.select().from(actualResults).where(eq(actualResults.matchId, matchId)).get();
  return row ? rowToResult(row) : null;
}

export function hasStoredResult(matchId: string): boolean {
  return getResult(matchId) !== null;
}

export function getPendingResults(): PendingResultView[] {
  const db = getDb();
  const rows = db.select().from(actualResults).where(eq(actualResults.confirmed, 0)).all();
  const teamMap = getTeamMap();
  const pending: PendingResultView[] = [];

  for (const row of rows) {
    const match = getResolvedMatch(row.matchId);
    if (!match || match.homeTeamId === "TBD" || match.awayTeamId === "TBD") continue;
    const home = teamMap.get(match.homeTeamId);
    const away = teamMap.get(match.awayTeamId);
    pending.push({
      ...rowToResult(row),
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeName: home?.name ?? match.homeTeamId,
      awayName: away?.name ?? match.awayTeamId,
      stage: match.stage,
      date: match.date,
    });
  }

  return pending.sort((a, b) => a.date.localeCompare(b.date));
}

export function upsertPendingResult(input: {
  matchId: string;
  homeScore: number;
  awayScore: number;
  et?: boolean;
  pens?: boolean;
  winnerTeamId?: string | null;
  source?: string;
}): ResultRow {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getResult(input.matchId);

  if (existing?.confirmed) {
    return existing;
  }

  if (input.homeScore < 0 || input.awayScore < 0) {
    throw new Error("Invalid match scores");
  }

  const values = {
    matchId: input.matchId,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    et: input.et ? 1 : 0,
    pens: input.pens ? 1 : 0,
    winnerTeamId: input.winnerTeamId ?? null,
    confirmed: 0,
    source: input.source ?? null,
    syncedAt: now,
    confirmedAt: null,
    confirmedBy: null,
  };

  db.insert(actualResults)
    .values(values)
    .onConflictDoUpdate({
      target: actualResults.matchId,
      set: {
        homeScore: values.homeScore,
        awayScore: values.awayScore,
        et: values.et,
        pens: values.pens,
        winnerTeamId: values.winnerTeamId,
        source: values.source,
        syncedAt: now,
      },
    })
    .run();

  return getResult(input.matchId)!;
}

/**
 * A knockout result with level scores requires an explicit, valid winner
 * (ET/pens) before it can be confirmed — never guess.
 */
export function isResultConfirmable(result: ResultRow): boolean {
  if (result.homeScore == null || result.awayScore == null) return false;

  const match = getResolvedMatch(result.matchId);
  if (!match || match.stage === "group") return true;
  if (result.homeScore !== result.awayScore) return true;
  if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") return false;
  return (
    result.winnerTeamId === match.homeTeamId || result.winnerTeamId === match.awayTeamId
  );
}

export function confirmResult(
  matchId: string,
  confirmedBy: "auto" | "admin",
): ResultRow | null {
  const db = getDb();
  const existing = getResult(matchId);
  if (!existing) return null;
  if (existing.confirmed) return existing;
  if (!isResultConfirmable(existing)) return null;

  const now = new Date().toISOString();
  db.update(actualResults)
    .set({
      confirmed: 1,
      confirmedAt: now,
      confirmedBy,
    })
    .where(eq(actualResults.matchId, matchId))
    .run();

  return getResult(matchId);
}

/** Revert a confirmed result to pending (admin fix for bad auto-confirms). */
export function unconfirmResult(matchId: string): boolean {
  const db = getDb();
  const existing = getResult(matchId);
  if (!existing?.confirmed) return false;

  db.update(actualResults)
    .set({
      confirmed: 0,
      confirmedAt: null,
      confirmedBy: null,
    })
    .where(eq(actualResults.matchId, matchId))
    .run();

  return true;
}

export function upsertConfirmedResult(
  input: {
    matchId: string;
    homeScore: number;
    awayScore: number;
    et?: boolean;
    pens?: boolean;
    winnerTeamId?: string | null;
    source?: string;
  },
  confirmedBy: "admin",
): ResultRow {
  const db = getDb();
  const now = new Date().toISOString();
  const match = getResolvedMatch(input.matchId);

  db.insert(actualResults)
    .values({
      matchId: input.matchId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      et: input.et ? 1 : 0,
      pens: input.pens ? 1 : 0,
      winnerTeamId: resolveWinner(input, match),
      confirmed: 1,
      source: input.source ?? "admin",
      syncedAt: now,
      confirmedAt: now,
      confirmedBy,
    })
    .onConflictDoUpdate({
      target: actualResults.matchId,
      set: {
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        et: input.et ? 1 : 0,
        pens: input.pens ? 1 : 0,
        winnerTeamId: resolveWinner(input, match),
        confirmed: 1,
        source: input.source ?? "admin",
        syncedAt: now,
        confirmedAt: now,
        confirmedBy,
      },
    })
    .run();

  return getResult(input.matchId)!;
}

function resolveWinner(
  input: { homeScore: number; awayScore: number; winnerTeamId?: string | null },
  match: Match | undefined,
): string | null {
  if (!match || match.homeTeamId === "TBD" || match.awayTeamId === "TBD") {
    return input.winnerTeamId ?? null;
  }
  if (match.stage === "group") return null;
  if (input.winnerTeamId === match.homeTeamId || input.winnerTeamId === match.awayTeamId) {
    return input.winnerTeamId;
  }
  if (input.homeScore > input.awayScore) return match.homeTeamId;
  if (input.awayScore > input.homeScore) return match.awayTeamId;
  // Level knockout score with no valid explicit winner — leave unresolved.
  return null;
}
