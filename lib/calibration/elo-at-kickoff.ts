import { eq } from "drizzle-orm";
import type { Match } from "@/lib/types";
import { getTeams } from "@/lib/data/load";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getDb } from "@/lib/db";
import { actualResults } from "@/lib/db/schema";
import { getWorldFootballEloSeedForTeam } from "@/lib/calibration/world-football-elo";
import {
  eloGroupMatchProbs,
  eloKnockoutMatchProbs,
} from "@/lib/calibration/elo-probabilities";
import { computeEloDelta } from "@/lib/calibration/elo";

const GROUP_K = 32;
const KNOCKOUT_K = 40;

function seedRatings(): Map<string, number> {
  return new Map(getTeams().map((team) => [team.id, getWorldFootballEloSeedForTeam(team.id)]));
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
  if (awayScore > homeScore) return 0;
  return 0.5;
}

function applyMatchToRatings(
  match: Match,
  result: { homeScore: number; awayScore: number; winnerTeamId: string | null },
  ratings: Map<string, number>,
): void {
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
}

/** Elo ratings immediately before kickoff — seeds plus all confirmed results strictly earlier. */
export function getEloRatingsBeforeKickoff(matchId: string): Map<string, number> | null {
  const target = getResolvedMatch(matchId);
  if (!target || target.homeTeamId === "TBD" || target.awayTeamId === "TBD") return null;

  const ratings = seedRatings();
  const db = getDb();
  const rows = db.select().from(actualResults).where(eq(actualResults.confirmed, 1)).all();

  const prior = rows
    .map((row) => {
      const match = getResolvedMatch(row.matchId);
      if (!match || match.homeTeamId === "TBD" || match.awayTeamId === "TBD") return null;
      if (row.homeScore == null || row.awayScore == null) return null;
      if (match.date >= target.date) return null;
      return { row, match };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((a, b) => a.match.date.localeCompare(b.match.date));

  for (const { row, match } of prior) {
    applyMatchToRatings(
      match,
      {
        homeScore: row.homeScore!,
        awayScore: row.awayScore!,
        winnerTeamId: row.winnerTeamId,
      },
      ratings,
    );
  }

  return ratings;
}

/** Pure Elo win/draw/loss probabilities (0–1) at kickoff for grading comparisons. */
export function eloProbabilitiesAtKickoff(
  matchId: string,
): { home: number; draw: number; away: number } | null {
  const match = getResolvedMatch(matchId);
  if (!match) return null;

  const ratings = getEloRatingsBeforeKickoff(matchId);
  if (!ratings) return null;

  const eloHome = ratings.get(match.homeTeamId);
  const eloAway = ratings.get(match.awayTeamId);
  if (eloHome == null || eloAway == null) return null;

  const probs =
    match.stage === "group"
      ? eloGroupMatchProbs(eloHome, eloAway)
      : eloKnockoutMatchProbs(eloHome, eloAway);

  return {
    home: probs.homeWinPct / 100,
    draw: probs.drawPct / 100,
    away: probs.awayWinPct / 100,
  };
}
