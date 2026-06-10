import { getTeam } from "@/lib/data/load";
import { listBets, listBettors } from "./store";

export type BettorLeaderboardRow = {
  bettorId: string;
  name: string;
  totalStaked: number;
  totalReturned: number;
  netPnl: number;
  openExposure: number;
  roi: number | null;
  wins: number;
  losses: number;
  openBets: number;
  rank: number;
};

export type PoolSummary = {
  poolName: string;
  totalHandle: number;
  totalPaidOut: number;
  openBets: number;
  settledBets: number;
  openExposure: number;
};

export function getPoolName(): string {
  return process.env.OFFICE_POOL_NAME?.trim() || "Office World Cup 2026";
}

export function getLeaderboard(): BettorLeaderboardRow[] {
  const bettors = listBettors();
  const allBets = listBets({ limit: 10_000 });

  const rows = bettors.map((bettor) => {
    const mine = allBets.filter((b) => b.bettorId === bettor.id);
    let totalStaked = 0;
    let totalReturned = 0;
    let openExposure = 0;
    let wins = 0;
    let losses = 0;
    let openBets = 0;

    for (const bet of mine) {
      if (bet.status === "open") {
        openExposure += bet.stakeMyr;
        openBets += 1;
        continue;
      }
      if (bet.status === "void") continue;

      totalStaked += bet.stakeMyr;
      if (bet.status === "won") {
        wins += 1;
        totalReturned += bet.payoutMyr ?? 0;
      } else if (bet.status === "lost") {
        losses += 1;
      }
    }

    const netPnl = totalReturned - totalStaked;
    const roi = totalStaked > 0 ? netPnl / totalStaked : null;

    return {
      bettorId: bettor.id,
      name: bettor.name,
      totalStaked,
      totalReturned,
      netPnl,
      openExposure,
      roi,
      wins,
      losses,
      openBets,
      rank: 0,
    };
  });

  rows.sort((a, b) => b.netPnl - a.netPnl || b.totalReturned - a.totalReturned);
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function getPoolSummary(): PoolSummary {
  const allBets = listBets({ limit: 10_000 });
  let totalHandle = 0;
  let totalPaidOut = 0;
  let openBets = 0;
  let settledBets = 0;
  let openExposure = 0;

  for (const bet of allBets) {
    if (bet.status === "open") {
      openBets += 1;
      openExposure += bet.stakeMyr;
      continue;
    }
    if (bet.status === "void") continue;

    settledBets += 1;
    totalHandle += bet.stakeMyr;
    if (bet.status === "won") {
      totalPaidOut += bet.payoutMyr ?? 0;
    }
  }

  return {
    poolName: getPoolName(),
    totalHandle,
    totalPaidOut,
    openBets,
    settledBets,
    openExposure,
  };
}

export function formatBetSelection(betType: string, selection: string): string {
  if (betType === "champion") {
    return getTeam(selection)?.name ?? selection;
  }
  if (selection === "home" || selection === "away" || selection === "draw") {
    return selection;
  }
  return selection;
}
