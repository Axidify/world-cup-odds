import { and, count, desc, eq, gt, lte } from "drizzle-orm";
import { getMatch, getTeamMap } from "@/lib/data/load";
import { getDb } from "@/lib/db";
import { actualResults } from "@/lib/db/schema";
import { formatMatchLabel } from "@/lib/utils/match-label";

export function getLatestConfirmedAt(): string | null {
  const db = getDb();
  const row = db
    .select({ confirmedAt: actualResults.confirmedAt })
    .from(actualResults)
    .where(eq(actualResults.confirmed, 1))
    .orderBy(desc(actualResults.confirmedAt))
    .limit(1)
    .get();
  return row?.confirmedAt ?? null;
}

export function countConfirmedSince(sinceIso: string): number {
  const db = getDb();
  const row = db
    .select({ n: count() })
    .from(actualResults)
    .where(and(eq(actualResults.confirmed, 1), gt(actualResults.confirmedAt, sinceIso)))
    .get();
  return row?.n ?? 0;
}

/** Confirmed results locked in at or before `untilIso` (inclusive). */
export function countConfirmedAtOrBefore(untilIso: string): number {
  const db = getDb();
  const row = db
    .select({ n: count() })
    .from(actualResults)
    .where(and(eq(actualResults.confirmed, 1), lte(actualResults.confirmedAt, untilIso)))
    .get();
  return row?.n ?? 0;
}

export type ConfirmedResultSummary = {
  matchId: string;
  label: string;
  score: string;
  confirmedAt: string;
};

/** Confirmed results after `sinceIso`, optionally before or at `untilIso`. */
export function listConfirmedBetween(
  sinceIso: string,
  untilIso?: string,
): ConfirmedResultSummary[] {
  const db = getDb();
  const teamMap = getTeamMap();
  const conditions = [eq(actualResults.confirmed, 1), gt(actualResults.confirmedAt, sinceIso)];
  if (untilIso) conditions.push(lte(actualResults.confirmedAt, untilIso));

  const rows = db
    .select()
    .from(actualResults)
    .where(and(...conditions))
    .orderBy(actualResults.confirmedAt)
    .all();

  return rows
    .filter((row) => row.homeScore != null && row.awayScore != null && row.confirmedAt)
    .map((row) => {
      const match = getMatch(row.matchId);
      const label = match ? formatMatchLabel(match, teamMap) : row.matchId;
      return {
        matchId: row.matchId,
        label,
        score: `${row.homeScore}–${row.awayScore}`,
        confirmedAt: row.confirmedAt!,
      };
    });
}
