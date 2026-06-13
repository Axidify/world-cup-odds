import type { BigBallsMatch, BigBallsMatchesResponse, BigBallsStatus } from "./types";

const DEFAULT_BASE = "https://api.bigballsdata.com";

export function isBigBallsConfigured(): boolean {
  return Boolean(process.env.BBS_API_KEY?.trim());
}

function baseUrl(): string {
  return (process.env.BBS_API_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

function fetchTimeoutMs(): number {
  const raw = Number(process.env.BBS_API_TIMEOUT_MS ?? 30_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 30_000;
}

function authHeaders(): HeadersInit {
  const token = process.env.BBS_API_KEY?.trim();
  if (!token) {
    throw new Error("BBS_API_KEY is not configured");
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

function looksLikeMatch(value: unknown): value is BigBallsMatch {
  if (!value || typeof value !== "object") return false;
  const row = value as BigBallsMatch;
  if (typeof row.id !== "string" || row.id.length === 0) return false;
  return Boolean(
    row.home ??
      row.away ??
      row.home_team ??
      row.away_team ??
      row.kickoff_utc ??
      row.kickoff ??
      row.start_time,
  );
}

/** WC2026 list responses may be a flat array or nested under data.matches / group buckets. */
export function normalizeBigBallsMatchesResponse(json: unknown): BigBallsMatch[] {
  if (!json || typeof json !== "object") return [];

  const root = json as BigBallsMatchesResponse;
  if (Array.isArray(root)) {
    return root.filter(looksLikeMatch);
  }

  if (Array.isArray(root.matches)) {
    return root.matches.filter(looksLikeMatch);
  }

  const data = root.data;
  if (Array.isArray(data)) {
    return data.filter(looksLikeMatch);
  }

  if (data && typeof data === "object") {
    const out: BigBallsMatch[] = [];
    for (const value of Object.values(data)) {
      if (Array.isArray(value)) {
        out.push(...value.filter(looksLikeMatch));
      }
    }
    if (out.length > 0) return out;
  }

  return [];
}

function mapStatusQuery(status?: "live" | "finished" | "upcoming"): string | undefined {
  if (!status) return undefined;
  if (status === "finished") return "final";
  return status;
}

export async function fetchWc2026Matches(options: {
  status?: "live" | "finished" | "upcoming";
} = {}): Promise<BigBallsMatch[]> {
  const params = new URLSearchParams();
  const apiStatus = mapStatusQuery(options.status);
  if (apiStatus) params.set("status", apiStatus);
  const query = params.toString();
  const url = `${baseUrl()}/v1/wc2026/matches${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(fetchTimeoutMs()),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Big Balls ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  const json = (await res.json()) as BigBallsMatchesResponse;
  if (json.error?.message) {
    throw new Error(`Big Balls: ${json.error.message}`);
  }

  return normalizeBigBallsMatchesResponse(json);
}

export async function getBigBallsStatus(): Promise<BigBallsStatus> {
  if (!isBigBallsConfigured()) {
    return { ok: false, matchCount: 0, finishedCount: 0, error: "not configured" };
  }

  try {
    const matches = await fetchWc2026Matches();
    const finishedCount = matches.filter((m) => isFinishedStatus(m.status)).length;
    return {
      ok: matches.length > 0,
      matchCount: matches.length,
      finishedCount,
    };
  } catch (err) {
    return {
      ok: false,
      matchCount: 0,
      finishedCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkBigBallsHealth(): Promise<boolean> {
  const status = await getBigBallsStatus();
  return status.ok;
}

export function isFinishedStatus(status: string | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return (
    normalized === "finished" ||
    normalized === "final" ||
    normalized === "complete" ||
    normalized === "completed"
  );
}

export function isLiveStatus(status: string | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return (
    normalized === "live" ||
    normalized === "in_progress" ||
    normalized === "in play" ||
    normalized === "halftime" ||
    normalized === "paused"
  );
}
