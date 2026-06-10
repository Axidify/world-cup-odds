import { getMatch } from "@/lib/data/load";
import { getDb } from "@/lib/db";
import { bets } from "@/lib/db/schema";
import { getResult } from "@/lib/results/store";
import { championBetWins, matchBetWins } from "./outcome";
import {
  getBet,
  listBetsForMatch,
  listOpenChampionBets,
  listOpenBetsForMatch,
  updateBetSettlement,
  type BetRow,
} from "./store";
import { potentialPayout } from "./odds";

function applySettlement(bet: BetRow, won: boolean): void {
  if (bet.status === "void") return;

  const now = new Date().toISOString();
  if (won) {
    updateBetSettlement(
      bet.id,
      "won",
      potentialPayout(bet.stakeMyr, bet.decimalOdds),
      now,
    );
  } else {
    updateBetSettlement(bet.id, "lost", 0, now);
  }
}

export function settleMatchBets(matchId: string): { settled: number; reconciled: number } {
  const match = getMatch(matchId);
  const result = getResult(matchId);
  if (!match || !result || !result.confirmed) return { settled: 0, reconciled: 0 };
  if (result.homeScore == null || result.awayScore == null) {
    return { settled: 0, reconciled: 0 };
  }

  let settled = 0;
  let reconciled = 0;

  const openBets = listOpenBetsForMatch(matchId);
  for (const bet of openBets) {
    const won = matchBetWins(match, bet.selection, result);
    applySettlement(bet, won);
    settled += 1;
  }

  const existing = listBetsForMatch(matchId).filter((b) => b.status === "won" || b.status === "lost");
  for (const bet of existing) {
    if (openBets.some((o) => o.id === bet.id)) continue;
    const won = matchBetWins(match, bet.selection, result);
    const expectedStatus = won ? "won" : "lost";
    const expectedPayout = won ? potentialPayout(bet.stakeMyr, bet.decimalOdds) : 0;
    if (bet.status !== expectedStatus || bet.payoutMyr !== expectedPayout) {
      applySettlement(bet, won);
      reconciled += 1;
    }
  }

  return { settled, reconciled };
}

export function settleChampionBets(): { settled: number } {
  const finalMatch = getMatch("final-1");
  if (!finalMatch) return { settled: 0 };

  const result = getResult("final-1");
  if (!result || !result.confirmed || !result.winnerTeamId) return { settled: 0 };

  const championId = result.winnerTeamId;
  let settled = 0;

  for (const bet of listOpenChampionBets()) {
    const won = championBetWins(bet.selection, championId);
    applySettlement(bet, won);
    settled += 1;
  }

  return { settled };
}

export function settleBetsForConfirmedMatch(matchId: string): void {
  settleMatchBets(matchId);
  if (matchId === "final-1") {
    settleChampionBets();
  }
}

export function voidBet(betId: string): boolean {
  const bet = getBet(betId);
  if (!bet || bet.status === "void") return false;

  const now = new Date().toISOString();
  updateBetSettlement(betId, "void", bet.stakeMyr, now);
  return true;
}

export function getRecentSettlements(limit = 10): BetRow[] {
  const db = getDb();
  return db
    .select()
    .from(bets)
    .all()
    .filter((b) => b.status === "won" || b.status === "lost" || b.status === "void")
    .sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? ""))
    .slice(0, limit)
    .map((row) => ({
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
    }));
}
