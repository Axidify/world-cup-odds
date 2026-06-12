import type { FootballDataMatch } from "@/lib/results/football-data/types";

const DEFAULT_BASE = "https://api.football-data.org";

export function isFootballDataConfigured(): boolean {
  return Boolean(process.env.FOOTBALL_DATA_API_TOKEN?.trim());
}

export function getFootballDataSeason(): string {
  return process.env.FOOTBALL_DATA_SEASON?.trim() || "2026";
}

function baseUrl(): string {
  return (process.env.FOOTBALL_DATA_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

export async function fetchWorldCupMatches(): Promise<FootballDataMatch[]> {
  const token = process.env.FOOTBALL_DATA_API_TOKEN?.trim();
  if (!token) {
    throw new Error("FOOTBALL_DATA_API_TOKEN is not configured");
  }

  const season = getFootballDataSeason();
  const url = `${baseUrl()}/v4/competitions/WC/matches?season=${encodeURIComponent(season)}`;

  const res = await fetch(url, {
    headers: {
      "X-Auth-Token": token,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data.org ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  const json = (await res.json()) as { matches?: FootballDataMatch[] };
  return json.matches ?? [];
}

export async function checkFootballDataHealth(): Promise<boolean> {
  if (!isFootballDataConfigured()) return false;
  try {
    const matches = await fetchWorldCupMatches();
    return Array.isArray(matches);
  } catch {
    return false;
  }
}
