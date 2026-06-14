import { eq, or, and } from "drizzle-orm";
import { sortTeamPair } from "@/lib/ai/cache-key";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getDb } from "@/lib/db";
import { predictionLog, predictions } from "@/lib/db/schema";
import { updateEloForMatch, recomputeEloFromConfirmedResults } from "@/lib/calibration/elo";
import { logPredictionAccuracy } from "@/lib/calibration/metrics";
import { confirmResult, unconfirmResult, upsertConfirmedResult } from "./store";

export function markTeamStale(teamId: string): void {
  const db = getDb();
  db.update(predictions)
    .set({ stale: 1 })
    .where(or(eq(predictions.teamA, teamId), eq(predictions.teamB, teamId)))
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

export function clearStaleForFixture(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
): void {
  const [teamA, teamB] = sortTeamPair(homeTeamId, awayTeamId);
  const db = getDb();
  db.update(predictions)
    .set({ stale: 0 })
    .where(
      and(eq(predictions.teamA, teamA), eq(predictions.teamB, teamB), eq(predictions.stage, stage)),
    )
    .run();
}

/** Confirm a pending result and run post-confirm hooks (accuracy log, stale teams). */
export function finalizeResultConfirmation(
  matchId: string,
  confirmedBy: "auto" | "admin",
): boolean {
  const match = getResolvedMatch(matchId);
  const confirmed = confirmResult(matchId, confirmedBy);
  if (!confirmed) return false;

  logPredictionAccuracy(matchId);
  updateEloForMatch(matchId);

  if (match && match.homeTeamId !== "TBD" && match.awayTeamId !== "TBD") {
    markTeamsStale(match.homeTeamId, match.awayTeamId);
    clearStaleForFixture(match.homeTeamId, match.awayTeamId, match.stage);
  }

  void import("@/lib/pipeline/auto-pipeline").then(({ scheduleAutoSimulation }) => {
    scheduleAutoSimulation("result_confirmed");
  });

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
  const match = getResolvedMatch(input.matchId);
  if (!match) return false;

  // Knockout ties need an explicit valid winner — refuse to confirm a guess.
  if (
    match.stage !== "group" &&
    input.homeScore === input.awayScore &&
    input.winnerTeamId !== match.homeTeamId &&
    input.winnerTeamId !== match.awayTeamId
  ) {
    return false;
  }

  upsertConfirmedResult(input, "admin");
  logPredictionAccuracy(input.matchId);
  updateEloForMatch(input.matchId);

  if (match.homeTeamId !== "TBD" && match.awayTeamId !== "TBD") {
    markTeamsStale(match.homeTeamId, match.awayTeamId);
  }

  void import("@/lib/pipeline/auto-pipeline").then(({ scheduleAutoSimulation }) => {
    scheduleAutoSimulation("result_confirmed");
  });

  return true;
}

/** Revert confirmation and replay Elo / accuracy state. */
export function finalizeResultUnconfirmation(matchId: string): boolean {
  const match = getResolvedMatch(matchId);
  if (!unconfirmResult(matchId)) return false;

  recomputeEloFromConfirmedResults();

  const db = getDb();
  db.delete(predictionLog).where(eq(predictionLog.matchId, matchId)).run();

  if (match && match.homeTeamId !== "TBD" && match.awayTeamId !== "TBD") {
    clearStaleForFixture(match.homeTeamId, match.awayTeamId, match.stage);
  }

  void import("@/lib/pipeline/auto-pipeline").then(({ scheduleAutoSimulation }) => {
    scheduleAutoSimulation("result_unconfirmed");
  });

  return true;
}
