import { deriveActualOutcome } from "@/lib/calibration/metrics";
import type { Match } from "@/lib/types";
import { isKnockoutStage } from "./locks";

export type BetSelection = "home" | "draw" | "away" | string;

export type SettleableResult = {
  homeScore: number;
  awayScore: number;
  winnerTeamId: string | null;
};

export function matchBetWins(
  match: Match,
  selection: BetSelection,
  result: SettleableResult,
): boolean {
  if (isKnockoutStage(match.stage)) {
    const winner =
      result.winnerTeamId ??
      (result.homeScore > result.awayScore
        ? match.homeTeamId
        : result.awayScore > result.homeScore
          ? match.awayTeamId
          : null);
    if (!winner) return false;
    if (selection === "home") return winner === match.homeTeamId;
    if (selection === "away") return winner === match.awayTeamId;
    return false;
  }

  const actual = deriveActualOutcome(match, result);
  return actual != null && selection === actual;
}

export function championBetWins(selection: string, championTeamId: string): boolean {
  return selection === championTeamId;
}
