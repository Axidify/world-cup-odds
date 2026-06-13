import { resolveTeamIdFromApi } from "@/lib/results/football-data/team-tla";
import type { BigBallsTeamRef } from "./types";

export function resolveTeamIdFromBigBalls(
  team: BigBallsTeamRef | string | null | undefined,
): string | null {
  if (!team) return null;
  if (typeof team === "string") {
    return resolveTeamIdFromApi({ name: team });
  }

  const tla = (team.abbr ?? team.short_name ?? team.team_id ?? team.id)?.trim().toUpperCase();
  if (tla) {
    const byTla = resolveTeamIdFromApi({ tla });
    if (byTla) return byTla;
    if (tla.length === 3) {
      const byLower = resolveTeamIdFromApi({ tla, name: team.name ?? team.team_name });
      if (byLower) return byLower;
    }
  }

  return resolveTeamIdFromApi({
    name: team.name ?? team.team_name,
    shortName: team.short_name,
    tla: team.abbr ?? team.short_name ?? team.team_id ?? team.id,
  });
}
