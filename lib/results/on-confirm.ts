import { eq, or } from "drizzle-orm";
import { getMatch } from "@/lib/data/load";
import { getDb } from "@/lib/db";
import { predictions } from "@/lib/db/schema";
import { settleBetsForConfirmedMatch } from "@/lib/betting/settle";
import { updateEloForMatch } from "@/lib/calibration/elo";
import { logPredictionAccuracy } from "@/lib/calibration/metrics";
import { confirmResult, upsertConfirmedResult } from "./store";

export function markTeamStale(teamId: string): void {
  const db = getDb();
  db.update(predictions)
    .set({ stale: 1 })
    .where(
      or(eq(predictions.teamA, teamId), eq(predictions.teamB, teamId)),
    )
    .run();
}

export function markTeamsStale(homeTeamId: string, awayTeamId: string): void {
  const db = getDb();
  db.update(predictions)
    .set({ stale: 1 })
    .where(
      or(
        eq(predictions.teamA, homeTeamId),
        eq(predictions.teamB, homeTeamId),
        eq(predictions.teamA, awayTeamId),
        eq(predictions.teamB, awayTeamId),
      ),
    )
    .run();
}

/** Confirm a pending result and run post-confirm hooks (accuracy log, stale teams). */
export function finalizeResultConfirmation(
  matchId: string,
  confirmedBy: "auto" | "admin",
): boolean {
  const match = getMatch(matchId);
  const confirmed = confirmResult(matchId, confirmedBy);
  if (!confirmed) return false;

  logPredictionAccuracy(matchId);
  updateEloForMatch(matchId);
  settleBetsForConfirmedMatch(matchId);

  if (match && match.homeTeamId !== "TBD" && match.awayTeamId !== "TBD") {
    markTeamsStale(match.homeTeamId, match.awayTeamId);
  }

  return true;
}

export function applyAdminConfirmedResult(input: {
  matchId: string;
  homeScore: number;
  awayScore: number;
  et?: boolean;
  pens?: boolean;
  winnerTeamId?: string | null;
  source?: string;
}): boolean {
  const match = getMatch(input.matchId);
  if (!match) return false;

  upsertConfirmedResult(input, "admin");
  logPredictionAccuracy(input.matchId);
  updateEloForMatch(input.matchId);
  settleBetsForConfirmedMatch(input.matchId);

  if (match.homeTeamId !== "TBD" && match.awayTeamId !== "TBD") {
    markTeamsStale(match.homeTeamId, match.awayTeamId);
  }

  return true;
}
