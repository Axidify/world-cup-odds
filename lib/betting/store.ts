import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bets, bettors } from "@/lib/db/schema";

export type BettorRow = {
  id: string;
  name: string;
  createdAt: string;
};

export type BetRow = {
  id: string;
  bettorId: string;
  betType: "match" | "champion";
  matchId: string | null;
  selection: string;
  stakeMyr: number;
  decimalOdds: number;
  potentialPayoutMyr: number;
  probabilityAtBet: number;
  status: "open" | "won" | "lost" | "void";
  payoutMyr: number | null;
  placedAt: string;
  settledAt: string | null;
};

function rowToBettor(row: typeof bettors.$inferSelect): BettorRow {
  return { id: row.id, name: row.name, createdAt: row.createdAt };
}

function rowToBet(row: typeof bets.$inferSelect): BetRow {
  return {
    id: row.id,
    bettorId: row.bettorId,
    betType: row.betType as BetRow["betType"],
    matchId: row.matchId,
    selection: row.selection,
    stakeMyr: row.stakeMyr,
    decimalOdds: row.decimalOdds,
    potentialPayoutMyr: row.potentialPayoutMyr,
    probabilityAtBet: row.probabilityAtBet,
    status: row.status as BetRow["status"],
    payoutMyr: row.payoutMyr,
    placedAt: row.placedAt,
    settledAt: row.settledAt,
  };
}

export function listBettors(): BettorRow[] {
  const db = getDb();
  return db.select().from(bettors).orderBy(bettors.name).all().map(rowToBettor);
}

export function getBettor(id: string): BettorRow | null {
  const db = getDb();
  const row = db.select().from(bettors).where(eq(bettors.id, id)).get();
  return row ? rowToBettor(row) : null;
}

export function getBettorByName(name: string): BettorRow | null {
  const db = getDb();
  const row = db.select().from(bettors).where(eq(bettors.name, name)).get();
  return row ? rowToBettor(row) : null;
}

export function createBettor(name: string): BettorRow {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const existing = getBettorByName(trimmed);
  if (existing) return existing;

  const id = `bettor-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const db = getDb();
  db.insert(bettors).values({ id, name: trimmed, createdAt: now }).run();
  return getBettor(id)!;
}

export function listBets(filters: {
  bettorId?: string;
  status?: string;
  matchId?: string;
  betType?: string;
  limit?: number;
} = {}): BetRow[] {
  const db = getDb();
  let rows = db.select().from(bets).orderBy(desc(bets.placedAt)).all();

  if (filters.bettorId) rows = rows.filter((r) => r.bettorId === filters.bettorId);
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.matchId) rows = rows.filter((r) => r.matchId === filters.matchId);
  if (filters.betType) rows = rows.filter((r) => r.betType === filters.betType);

  const limit = filters.limit ?? 200;
  return rows.slice(0, limit).map(rowToBet);
}

export function getBet(id: string): BetRow | null {
  const db = getDb();
  const row = db.select().from(bets).where(eq(bets.id, id)).get();
  return row ? rowToBet(row) : null;
}

export function insertBet(input: Omit<BetRow, "settledAt"> & { settledAt?: string | null }): BetRow {
  const db = getDb();
  db.insert(bets)
    .values({
      id: input.id,
      bettorId: input.bettorId,
      betType: input.betType,
      matchId: input.matchId,
      selection: input.selection,
      stakeMyr: input.stakeMyr,
      decimalOdds: input.decimalOdds,
      potentialPayoutMyr: input.potentialPayoutMyr,
      probabilityAtBet: input.probabilityAtBet,
      status: input.status,
      payoutMyr: input.payoutMyr,
      placedAt: input.placedAt,
      settledAt: input.settledAt ?? null,
    })
    .run();
  return getBet(input.id)!;
}

export function updateBetSettlement(
  id: string,
  status: BetRow["status"],
  payoutMyr: number | null,
  settledAt: string | null,
): void {
  const db = getDb();
  db.update(bets)
    .set({ status, payoutMyr, settledAt })
    .where(eq(bets.id, id))
    .run();
}

export function countOpenBets(): number {
  const db = getDb();
  return db.select().from(bets).where(eq(bets.status, "open")).all().length;
}

export function listOpenBetsForMatch(matchId: string): BetRow[] {
  const db = getDb();
  return db
    .select()
    .from(bets)
    .where(and(eq(bets.matchId, matchId), eq(bets.status, "open")))
    .all()
    .map(rowToBet);
}

export function listOpenChampionBets(): BetRow[] {
  const db = getDb();
  return db
    .select()
    .from(bets)
    .where(and(eq(bets.betType, "champion"), eq(bets.status, "open")))
    .all()
    .map(rowToBet);
}

export function listBetsForMatch(matchId: string, includeSettled = true): BetRow[] {
  const db = getDb();
  let rows = db.select().from(bets).where(eq(bets.matchId, matchId)).all().map(rowToBet);
  if (!includeSettled) rows = rows.filter((b) => b.status === "open");
  return rows;
}
