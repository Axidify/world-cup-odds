import { eq } from "drizzle-orm";
import type { Match } from "@/lib/types";
import { getTeam, getTeams } from "@/lib/data/load";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getDb } from "@/lib/db";
import { actualResults, calibrationState, eloRatings } from "@/lib/db/schema";

const GROUP_K = 32;
const KNOCKOUT_K = 40;

export function fifaRankToElo(fifaRank: number): number {
  return Math.round(2100 - (fifaRank - 1) * 7.5);
}

export function expectedHomeScore(eloHome: number, eloAway: number): number {
  return 1 / (1 + 10 ** ((eloAway - eloHome) / 400));
}

export function ensureEloInitialized(): void {
  const db = getDb();
  const now = new Date().toISOString();
  for (const team of getTeams()) {
    const row = db.select().from(eloRatings).where(eq(eloRatings.teamId, team.id)).get();
    if (row) continue;
    db.insert(eloRatings)
      .values({
        teamId: team.id,
        rating: fifaRankToElo(team.fifaRank),
        updatedAt: now,
      })
      .run();
  }
}

export function getEloRating(teamId: string): number | null {
  ensureEloInitialized();
  const team = getTeam(teamId);
  if (!team) return null;

  const db = getDb();
  const row = db.select().from(eloRatings).where(eq(eloRatings.teamId, teamId)).get();
  return row?.rating ?? fifaRankToElo(team.fifaRank);
}

export function getEloMap(): Map<string, number> {
  ensureEloInitialized();
  const db = getDb();
  const rows = db.select().from(eloRatings).all();
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.teamId, row.rating);
  }
  for (const team of getTeams()) {
    if (!map.has(team.id)) {
      map.set(team.id, fifaRankToElo(team.fifaRank));
    }
  }
  return map;
}

function actualHomePoints(
  match: Match,
  homeScore: number,
  awayScore: number,
  winnerTeamId: string | null,
): number {
  if (match.stage === "group") {
    if (homeScore > awayScore) return 1;
    if (homeScore < awayScore) return 0;
    return 0.5;
  }
  if (winnerTeamId === match.homeTeamId) return 1;
  if (winnerTeamId === match.awayTeamId) return 0;
  if (homeScore > awayScore) return 1;
  if (homeScore < awayScore) return 0;
  // Knockout decided on ET/pens with unknown winner: treat as a draw
  // for rating purposes rather than crediting the home side.
  return 0.5;
}

export function computeEloDelta(
  eloHome: number,
  eloAway: number,
  actualHome: number,
  kFactor: number,
): { homeDelta: number; awayDelta: number } {
  const expected = expectedHomeScore(eloHome, eloAway);
  const homeDelta = kFactor * (actualHome - expected);
  return { homeDelta, awayDelta: -homeDelta };
}

type StoredEloAdjustment = { homeDelta: number; awayDelta: number };

function eloAdjustmentKey(matchId: string): string {
  return `elo_match:${matchId}`;
}

function clearEloAdjustments(): void {
  const db = getDb();
  for (const row of db.select().from(calibrationState).all()) {
    if (!row.key.startsWith("elo_match:")) continue;
    db.delete(calibrationState).where(eq(calibrationState.key, row.key)).run();
  }
}

function storeEloAdjustment(matchId: string, adjustment: StoredEloAdjustment): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.insert(calibrationState)
    .values({
      key: eloAdjustmentKey(matchId),
      value: JSON.stringify(adjustment),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: calibrationState.key,
      set: { value: JSON.stringify(adjustment), updatedAt: now },
    })
    .run();
}

function persistRatings(ratings: Map<string, number>): void {
  const db = getDb();
  const now = new Date().toISOString();
  for (const [teamId, rating] of ratings) {
    db.update(eloRatings)
      .set({ rating: Math.round(rating * 10) / 10, updatedAt: now })
      .where(eq(eloRatings.teamId, teamId))
      .run();
  }
}

function seedRatings(): Map<string, number> {
  return new Map(getTeams().map((team) => [team.id, fifaRankToElo(team.fifaRank)]));
}

function applyMatchToRatings(
  match: Match,
  result: { homeScore: number; awayScore: number; winnerTeamId: string | null },
  ratings: Map<string, number>,
): StoredEloAdjustment {
  const eloHome = ratings.get(match.homeTeamId)!;
  const eloAway = ratings.get(match.awayTeamId)!;
  const k = match.stage === "group" ? GROUP_K : KNOCKOUT_K;
  const actualHome = actualHomePoints(
    match,
    result.homeScore,
    result.awayScore,
    result.winnerTeamId,
  );
  const { homeDelta, awayDelta } = computeEloDelta(eloHome, eloAway, actualHome, k);
  ratings.set(match.homeTeamId, eloHome + homeDelta);
  ratings.set(match.awayTeamId, eloAway + awayDelta);
  return { homeDelta, awayDelta };
}

/** Replay all confirmed results in kickoff order — correct after admin corrections. */
export function recomputeEloFromConfirmedResults(): void {
  ensureEloInitialized();
  const db = getDb();
  const ratings = seedRatings();
  clearEloAdjustments();

  const rows = db.select().from(actualResults).where(eq(actualResults.confirmed, 1)).all();
  const dated = rows
    .map((row) => {
      const match = getResolvedMatch(row.matchId);
      if (!match || match.homeTeamId === "TBD" || match.awayTeamId === "TBD") return null;
      if (row.homeScore == null || row.awayScore == null) return null;
      return { row, match };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((a, b) => a.match.date.localeCompare(b.match.date));

  for (const { row, match } of dated) {
    const adjustment = applyMatchToRatings(
      match,
      {
        homeScore: row.homeScore!,
        awayScore: row.awayScore!,
        winnerTeamId: row.winnerTeamId,
      },
      ratings,
    );
    storeEloAdjustment(match.id, adjustment);
  }

  persistRatings(ratings);
}

export function updateEloForMatch(matchId: string): boolean {
  const match = getResolvedMatch(matchId);
  const db = getDb();
  const row = db.select().from(actualResults).where(eq(actualResults.matchId, matchId)).get();
  if (!match || !row || row.confirmed !== 1) return false;
  if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") return false;
  if (row.homeScore == null || row.awayScore == null) return false;

  recomputeEloFromConfirmedResults();
  return true;
}
