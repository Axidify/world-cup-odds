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

function fetchTimeoutMs(): number {
  const raw = Number(process.env.FOOTBALL_DATA_TIMEOUT_MS ?? 30_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 30_000;
}

export type FootballDataStatus = {
  ok: boolean;
  season: string;
  matchCount: number;
  finishedCount: number;
  error?: string;
};

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
    signal: AbortSignal.timeout(fetchTimeoutMs()),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data.org ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  const json = (await res.json()) as { matches?: FootballDataMatch[] };
  return json.matches ?? [];
}

export async function getFootballDataStatus(): Promise<FootballDataStatus> {
  const season = getFootballDataSeason();
  if (!isFootballDataConfigured()) {
    return { ok: false, season, matchCount: 0, finishedCount: 0, error: "not configured" };
  }

  try {
    const matches = await fetchWorldCupMatches();
    const finishedCount = matches.filter((m) => m.status === "FINISHED").length;
    return {
      ok: matches.length > 0,
      season,
      matchCount: matches.length,
      finishedCount,
    };
  } catch (err) {
    return {
      ok: false,
      season,
      matchCount: 0,
      finishedCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkFootballDataHealth(): Promise<boolean> {
  const status = await getFootballDataStatus();
  return status.ok;
}
