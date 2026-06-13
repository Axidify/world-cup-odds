import { resolveTeamIdFromApi } from "@/lib/results/football-data/team-tla";
import type { BigBallsTeamRef } from "./types";

export function resolveTeamIdFromBigBalls(
  team: BigBallsTeamRef | string | null | undefined,
): string | null {
  if (!team) return null;
  if (typeof team === "string") {
    return resolveTeamIdFromApi({ name: team });
  }

  const tla = (team.abbr ?? team.short_name)?.trim().toUpperCase();
  if (tla) {
    const byTla = resolveTeamIdFromApi({ tla });
    if (byTla) return byTla;
  }

  return resolveTeamIdFromApi({
    name: team.name,
    shortName: team.short_name,
    tla: team.abbr ?? team.short_name,
  });
}
