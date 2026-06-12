import { eq } from "drizzle-orm";
import type { ActualOutcome } from "@/lib/calibration/metrics";
import type { Team } from "@/lib/types";
import { getTeam } from "@/lib/data/load";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getDb } from "@/lib/db";
import { actualResults, predictionLog } from "@/lib/db/schema";
import { pickFavoriteOutcome, storedPredictedToProbs } from "@/lib/calibration/metrics";
const RECENT_RESULTS_LIMIT = 3;
const ERROR_MEMORY_LIMIT = 4;

function formatRecentResult(matchId: string): string | null {
  const match = getResolvedMatch(matchId);
  const db = getDb();
  const row = db.select().from(actualResults).where(eq(actualResults.matchId, matchId)).get();
  if (!match || !row || row.confirmed !== 1) return null;
  if (row.homeScore == null || row.awayScore == null) return null;

  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (!home || !away) return null;

  return `${home.name} ${row.homeScore}–${row.awayScore} ${away.name}`;
}

function getRecentResultsForTeam(teamId: string): string[] {
  const db = getDb();
  const confirmed = db.select().from(actualResults).where(eq(actualResults.confirmed, 1)).all();
  const lines: Array<{ date: string; line: string }> = [];

  for (const row of confirmed) {
    const match = getResolvedMatch(row.matchId);
    if (!match || match.homeTeamId === "TBD" || match.awayTeamId === "TBD") continue;
    if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) continue;
    const line = formatRecentResult(row.matchId);
    if (line) lines.push({ date: match.date, line });
  }

  return lines
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_RESULTS_LIMIT)
    .map((l) => l.line);
}

function getPredictionErrorNotes(homeId: string, awayId: string): string[] {
  const db = getDb();
  const logs = db.select().from(predictionLog).all();
  const notes: Array<{ brier: number; note: string; matchId: string }> = [];
  const seen = new Set<string>();

  for (const row of logs) {
    if (seen.has(row.matchId)) continue;
    const match = getResolvedMatch(row.matchId);
    if (!match || (match.homeTeamId !== homeId && match.awayTeamId !== awayId)) continue;

    let predicted: { home: number; draw: number; away: number };
    try {
      predicted = JSON.parse(row.predicted) as { home: number; draw: number; away: number };
    } catch {
      continue;
    }
    const fav = pickFavoriteOutcome(predicted, match.stage);
    const actual = row.actual as ActualOutcome;
    const probs = storedPredictedToProbs(predicted);
    const favPct = Math.round(predicted[fav]);
    const correct = fav === actual;
    const home = getTeam(match.homeTeamId);
    const away = getTeam(match.awayTeamId);
    if (!home || !away) continue;

    const direction = correct ? "correct direction" : `wrong — actual ${actual}`;
    const overconf =
      !correct && favPct >= 55 ? `, overconfident by ~${favPct - Math.round(probs[actual] * 100)}%` : "";
    seen.add(row.matchId);
    notes.push({
      matchId: row.matchId,
      brier: row.brier ?? 0,
      note: `${home.name} vs ${away.name}: predicted ${fav} (${favPct}%), ${direction}${overconf}`,
    });
  }

  return notes
    .sort((a, b) => b.brier - a.brier)
    .slice(0, ERROR_MEMORY_LIMIT)
    .map((n) => n.note);
}

export function buildLearningContext(home: Team, away: Team): string {
  const lines: string[] = ["LEARNING CONTEXT:"];

  const homeResults = getRecentResultsForTeam(home.id);
  const awayResults = getRecentResultsForTeam(away.id);
  if (homeResults.length > 0) {
    lines.push(`- ${home.name} recent results: ${homeResults.join("; ")}`);
  }
  if (awayResults.length > 0) {
    lines.push(`- ${away.name} recent results: ${awayResults.join("; ")}`);
  }

  const errors = getPredictionErrorNotes(home.id, away.id);
  if (errors.length > 0) {
    lines.push("- Past prediction notes:");
    for (const e of errors) lines.push(`  - ${e}`);
  }

  return lines.join("\n");
}
