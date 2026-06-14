import type { Match } from "@/lib/types";
import type { FootballDataMatch } from "@/lib/results/football-data/types";
import type { ParsedFootballDataResult } from "@/lib/results/football-data/types";
import { resolveTeamIdFromApi } from "@/lib/results/football-data/team-tla";

const KICKOFF_TOLERANCE_MS = 18 * 60 * 60 * 1000;

function readScoreSide(scores: Record<string, number | null> | null | undefined, side: "home" | "away"): number | null {
  if (!scores) return null;
  const keys = side === "home" ? ["home", "homeTeam"] : ["away", "awayTeam"];
  for (const key of keys) {
    const value = scores[key];
    if (typeof value === "number" && value >= 0) return value;
  }
  return null;
}

export function kickoffsAlign(localIso: string, apiUtc: string): boolean {
  const diff = Math.abs(new Date(localIso).getTime() - new Date(apiUtc).getTime());
  return diff <= KICKOFF_TOLERANCE_MS;
}

export function linksApiMatchToLocal(api: FootballDataMatch, local: Match): boolean {
  if (local.homeTeamId === "TBD" || local.awayTeamId === "TBD") return false;
  const homeId = resolveTeamIdFromApi(api.homeTeam);
  const awayId = resolveTeamIdFromApi(api.awayTeam);
  if (!homeId || !awayId) return false;
  if (homeId !== local.homeTeamId || awayId !== local.awayTeamId) return false;
  return kickoffsAlign(local.date, api.utcDate);
}

export function parseFinishedApiMatch(
  api: FootballDataMatch,
  local: Match,
): ParsedFootballDataResult | null {
  if (api.status !== "FINISHED") return null;

  const homeScore = readScoreSide(api.score?.fullTime ?? null, "home");
  const awayScore = readScoreSide(api.score?.fullTime ?? null, "away");
  if (homeScore == null || awayScore == null) return null;

  const pens =
    readScoreSide(api.score?.penalties ?? null, "home") != null ||
    readScoreSide(api.score?.penalties ?? null, "away") != null;
  const et =
    pens ||
    api.score?.duration === "EXTRA_TIME" ||
    readScoreSide(api.score?.extraTime ?? null, "home") != null;

  let winnerTeamId: string | null = null;
  if (local.stage !== "group") {
    if (api.score?.winner === "HOME_TEAM") winnerTeamId = local.homeTeamId;
    else if (api.score?.winner === "AWAY_TEAM") winnerTeamId = local.awayTeamId;
    else if (homeScore > awayScore) winnerTeamId = local.homeTeamId;
    else if (awayScore > homeScore) winnerTeamId = local.awayTeamId;
  }

  return {
    apiMatchId: api.id,
    homeScore,
    awayScore,
    et,
    pens,
    winnerTeamId,
    source: JSON.stringify({
      provider: "football-data.org",
      apiMatchId: api.id,
      status: api.status,
      syncedAt: new Date().toISOString(),
    }),
  };
}

export function indexFinishedMatches(
  apiMatches: FootballDataMatch[],
  localMatches: Match[],
): Map<string, ParsedFootballDataResult> {
  const out = new Map<string, ParsedFootballDataResult>();
  const finished = apiMatches.filter((m) => m.status === "FINISHED");

  for (const local of localMatches) {
    const api = finished.find((candidate) => linksApiMatchToLocal(candidate, local));
    if (!api) continue;
    const parsed = parseFinishedApiMatch(api, local);
    if (parsed) out.set(local.id, parsed);
  }

  return out;
}

/** Prefer detail scores; flag when WC list and match detail disagree. */
export function indexFinishedMatchesWithListDetailAgreement(
  listApiMatches: FootballDataMatch[],
  detailApiMatches: FootballDataMatch[],
  localMatches: Match[],
): Map<string, ParsedFootballDataResult & { listDetailAgree: boolean }> {
  const listIndex = indexFinishedMatches(listApiMatches, localMatches);
  const detailIndex = indexFinishedMatches(detailApiMatches, localMatches);
  const out = new Map<string, ParsedFootballDataResult & { listDetailAgree: boolean }>();

  for (const local of localMatches) {
    const parsed = detailIndex.get(local.id);
    if (!parsed) continue;

    const listParsed = listIndex.get(local.id);
    const listDetailAgree =
      listParsed == null ||
      (listParsed.homeScore === parsed.homeScore && listParsed.awayScore === parsed.awayScore);

    out.set(local.id, { ...parsed, listDetailAgree });
  }

  return out;
}

export function readLiveFootballDataScores(
  api: FootballDataMatch,
): { home: number; away: number } | null {
  const home =
    readScoreSide(api.score?.fullTime ?? null, "home") ??
    readScoreSide(api.score?.halfTime ?? null, "home");
  const away =
    readScoreSide(api.score?.fullTime ?? null, "away") ??
    readScoreSide(api.score?.halfTime ?? null, "away");
  if (home == null || away == null) return null;
  return { home, away };
}

export function formatLiveFootballDataMinute(api: FootballDataMatch): string | null {
  if (api.minute != null && Number.isFinite(api.minute)) {
    const injury =
      api.injuryTime != null && Number.isFinite(api.injuryTime) && api.injuryTime > 0
        ? `+${api.injuryTime}`
        : "";
    return `${api.minute}${injury}`;
  }
  if (api.status === "PAUSED") return "HT";
  return null;
}

/** Fetch match detail for FINISHED API rows linked to local fixtures (list scores can lag). */
export async function enrichLinkedFinishedMatches(
  apiMatches: FootballDataMatch[],
  localMatches: Match[],
  fetchDetail: (apiMatchId: number) => Promise<FootballDataMatch>,
): Promise<FootballDataMatch[]> {
  const finished = apiMatches.filter((m) => m.status === "FINISHED");
  const linkedIds = new Set<number>();

  for (const local of localMatches) {
    const api = finished.find((candidate) => linksApiMatchToLocal(candidate, local));
    if (api) linkedIds.add(api.id);
  }

  if (linkedIds.size === 0) return apiMatches;

  const detailById = new Map<number, FootballDataMatch>();
  await Promise.all(
    [...linkedIds].map(async (id) => {
      try {
        detailById.set(id, await fetchDetail(id));
      } catch {
        // keep list row on detail failure
      }
    }),
  );

  return apiMatches.map((match) => {
    const detail = detailById.get(match.id);
    if (!detail) return match;
    return {
      ...match,
      status: detail.status ?? match.status,
      score: detail.score ?? match.score,
    };
  });
}

/** Fill minute from match detail when the WC list response omits it. */
export async function enrichLiveFootballDataMatches(
  matches: FootballDataMatch[],
  fetchDetail: (apiMatchId: number) => Promise<FootballDataMatch>,
): Promise<FootballDataMatch[]> {
  return Promise.all(
    matches.map(async (match) => {
      if (formatLiveFootballDataMinute(match) != null) return match;
      if (match.status !== "IN_PLAY" && match.status !== "LIVE" && match.status !== "PAUSED") {
        return match;
      }

      try {
        const detail = await fetchDetail(match.id);
        return {
          ...match,
          status: detail.status ?? match.status,
          minute: detail.minute ?? match.minute,
          injuryTime: detail.injuryTime ?? match.injuryTime,
          score: detail.score ?? match.score,
        };
      } catch {
        return match;
      }
    }),
  );
}

export function mapLiveFootballDataToLocal(
  apiMatches: FootballDataMatch[],
  localMatches: Match[],
): Array<{ matchId: string; homeScore: number; awayScore: number; status: string | null; minute: string | null }> {
  const out: Array<{
    matchId: string;
    homeScore: number;
    awayScore: number;
    status: string | null;
    minute: string | null;
  }> = [];

  for (const local of localMatches) {
    const api = apiMatches.find((candidate) => linksApiMatchToLocal(candidate, local));
    if (!api) continue;

    const scores = readLiveFootballDataScores(api);
    if (!scores) continue;

    out.push({
      matchId: local.id,
      homeScore: scores.home,
      awayScore: scores.away,
      status: api.status ?? null,
      minute: formatLiveFootballDataMinute(api),
    });
  }

  return out;
}
