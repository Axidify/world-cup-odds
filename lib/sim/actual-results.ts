import { eq } from "drizzle-orm";
import type { PlayedMatchResult } from "@/lib/types";
import { getMatch } from "@/lib/data/load";
import { getDb } from "@/lib/db";
import { actualResults } from "@/lib/db/schema";

export function getConfirmedResults(): Map<string, PlayedMatchResult> {
  const db = getDb();
  const rows = db.select().from(actualResults).where(eq(actualResults.confirmed, 1)).all();
  const map = new Map<string, PlayedMatchResult>();

  for (const row of rows) {
    if (row.homeScore == null || row.awayScore == null) continue;
    const match = getMatch(row.matchId);
    if (!match) continue;

    map.set(row.matchId, {
      matchId: row.matchId,
      homeTeamId: match.homeTeamId !== "TBD" ? match.homeTeamId : "",
      awayTeamId: match.awayTeamId !== "TBD" ? match.awayTeamId : "",
      homeGoals: row.homeScore,
      awayGoals: row.awayScore,
      winnerTeamId: row.winnerTeamId ?? undefined,
    });
  }

  return map;
}
