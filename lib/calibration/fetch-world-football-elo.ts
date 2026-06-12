import { TEAM_ID_TO_ELO_CODE, type WorldFootballEloData } from "@/lib/calibration/world-football-elo";

export const WORLD_FOOTBALL_ELO_TSV_URL = "https://www.eloratings.net/World.tsv";

/** Parse https://www.eloratings.net/World.tsv into team-id ratings. */
export function parseWorldFootballEloTsv(text: string): Record<string, number> {
  const byCode: Record<string, number> = {};
  for (const line of text.trim().split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const rating = Number(parts[3]);
    if (Number.isFinite(rating)) byCode[parts[2]] = rating;
  }

  const ratings: Record<string, number> = {};
  const missing: string[] = [];

  for (const [teamId, code] of Object.entries(TEAM_ID_TO_ELO_CODE)) {
    const rating = byCode[code];
    if (!Number.isFinite(rating)) {
      missing.push(`${teamId} (${code})`);
      continue;
    }
    ratings[teamId] = rating;
  }

  if (missing.length > 0) {
    throw new Error(`Missing World Football Elo codes: ${missing.join(", ")}`);
  }

  return ratings;
}

export async function fetchWorldFootballEloRatings(): Promise<WorldFootballEloData> {
  const res = await fetch(WORLD_FOOTBALL_ELO_TSV_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${WORLD_FOOTBALL_ELO_TSV_URL}: ${res.status}`);
  }
  const text = await res.text();
  return {
    source: WORLD_FOOTBALL_ELO_TSV_URL,
    asOf: res.headers.get("last-modified") ?? new Date().toUTCString(),
    ratings: parseWorldFootballEloTsv(text),
  };
}
