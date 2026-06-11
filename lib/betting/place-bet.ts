import { getBettor, insertBet } from "./store";
import { isSimulationStale } from "@/lib/sim/simulation-cache";
import { getChampionOddsLine } from "./lines";
import { getFixedStakeMyr, isTournamentLocked } from "./locks";
import { potentialPayout } from "./odds";

export type PlaceBetInput = {
  bettorId: string;
  betType: "match" | "champion";
  matchId?: string;
  selection: string;
  stakeMyr: number;
};

export type PlaceBetResult =
  | { ok: true; betId: string }
  | { ok: false; error: string };

export function placeBet(input: PlaceBetInput): PlaceBetResult {
  const bettor = getBettor(input.bettorId);
  if (!bettor) return { ok: false, error: "Bettor not found" };

  // Office pool is champion-only with a fixed stake.
  if (input.betType !== "champion") {
    return { ok: false, error: "This pool only takes World Cup winner bets" };
  }

  const fixedStake = getFixedStakeMyr();
  if (!Number.isFinite(input.stakeMyr) || input.stakeMyr !== fixedStake) {
    return { ok: false, error: `Stake is fixed at RM ${fixedStake.toFixed(2)}` };
  }

  return placeChampionBet(input);
}

function placeChampionBet(input: PlaceBetInput): PlaceBetResult {
  if (isTournamentLocked()) {
    return { ok: false, error: "Champion betting is locked for this tournament" };
  }
  if (isSimulationStale()) {
    return { ok: false, error: "Champion odds are stale — re-run simulation first" };
  }

  const line = getChampionOddsLine(input.selection);
  if (!line) {
    return { ok: false, error: "No champion odds — run simulation first" };
  }

  const now = new Date().toISOString();
  const id = `bet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  insertBet({
    id,
    bettorId: input.bettorId,
    betType: "champion",
    matchId: null,
    selection: input.selection,
    stakeMyr: input.stakeMyr,
    decimalOdds: line.decimalOdds,
    potentialPayoutMyr: potentialPayout(input.stakeMyr, line.decimalOdds),
    probabilityAtBet: line.probabilityPct,
    status: "open",
    payoutMyr: null,
    placedAt: now,
  });

  return { ok: true, betId: id };
}
