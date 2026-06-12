import type { Team } from "@/lib/types";
import { getEloRating } from "@/lib/calibration/elo";
import { getWorldFootballEloSeed } from "@/lib/calibration/world-football-elo";

/** Team strength block for LLM prompts — World Football Elo first. */
export function formatTeamStrengthBlock(team: Team): string {
  const prior = getWorldFootballEloSeed(team.id);
  const current = getEloRating(team.id);
  const lines = [
    `- World Football Elo: ${prior ?? "—"} (eloratings.net)`,
    `- FIFA rank: #${team.fifaRank}`,
    `- Confederation: ${team.confederation}`,
  ];
  if (
    current != null &&
    prior != null &&
    Math.round(current) !== prior
  ) {
    lines.splice(
      1,
      0,
      `- Tournament Elo (after confirmed results): ${Math.round(current)}`,
    );
  }
  return lines.join("\n");
}
