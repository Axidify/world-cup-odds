import { getMatch } from "@/lib/data/load";
import { getBettor, insertBet } from "./store";
import { getChampionOddsLine, getMatchOddsSnapshot } from "./lines";
import {
  getMinStakeMyr,
  isKnockoutStage,
  isMatchBettingLocked,
  isTournamentLocked,
} from "./locks";
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

  const minStake = getMinStakeMyr();
  if (!Number.isFinite(input.stakeMyr) || input.stakeMyr < minStake) {
    return { ok: false, error: `Minimum stake is RM ${minStake.toFixed(2)}` };
  }

  if (input.betType === "match") {
    return placeMatchBet(input);
  }
  return placeChampionBet(input);
}

function placeMatchBet(input: PlaceBetInput): PlaceBetResult {
  if (!input.matchId) return { ok: false, error: "matchId required for match bets" };

  const match = getMatch(input.matchId);
  if (!match) return { ok: false, error: "Match not found" };
  if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") {
    return { ok: false, error: "Teams not determined for this match" };
  }
  if (isMatchBettingLocked(match)) {
    return { ok: false, error: "Betting closed — match has kicked off" };
  }

  const snapshot = getMatchOddsSnapshot(input.matchId);
  if (!snapshot) {
    return { ok: false, error: "No AI odds available — analyze this match first" };
  }

  const knockout = isKnockoutStage(match.stage);
  const allowed = knockout ? ["home", "away"] : ["home", "draw", "away"];
  if (!allowed.includes(input.selection)) {
    return { ok: false, error: knockout ? "Knockout bets are home or away only" : "Invalid selection" };
  }

  const line = snapshot.lines.find((l) => l.selection === input.selection);
  if (!line) return { ok: false, error: "Invalid selection for this match" };

  const now = new Date().toISOString();
  const id = `bet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  insertBet({
    id,
    bettorId: input.bettorId,
    betType: "match",
    matchId: input.matchId,
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

function placeChampionBet(input: PlaceBetInput): PlaceBetResult {
  if (isTournamentLocked()) {
    return { ok: false, error: "Champion betting is locked for this tournament" };
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
