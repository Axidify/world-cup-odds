import { getTeam, getTeamMap } from "@/lib/data/load";
import { getResolvedMatches } from "@/lib/data/resolved";
import { extractTeamNews } from "@/lib/ai/summarize-news";
import {
  getLatestFetchAt,
  getTeamNewsSummary,
  replaceTeamEvents,
  setTeamNewsSummary,
  teamNewsFingerprint,
} from "@/lib/news/store";
import { isNewsImpactEnabled } from "@/lib/news/impact";
import { markTeamStale } from "@/lib/results/on-confirm";
import { searchWeb } from "@/lib/search/provider";

const UPCOMING_WINDOW_MS = 48 * 60 * 60 * 1000;
const NEWS_TTL_MS = 6 * 60 * 60 * 1000;
const MATCHDAY_TTL_MS = 2 * 60 * 60 * 1000;

/** Reject LLM extractions that would wipe existing squad events with an empty list. */
export function shouldRejectEmptyNewsExtraction(
  previousEvents: Array<unknown>,
  nextEvents: Array<unknown>,
): boolean {
  return previousEvents.length > 0 && nextEvents.length === 0;
}

function buildNewsQuery(teamId: string): string {
  const team = getTeamMap().get(teamId);
  const name = team?.name ?? teamId;
  return `2026 FIFA World Cup ${name} injury suspension squad news`;
}

function nextKickoffForTeam(teamId: string): number | null {
  const now = Date.now();
  let nearest: number | null = null;
  for (const m of getResolvedMatches()) {
    if (m.homeTeamId !== teamId && m.awayTeamId !== teamId) continue;
    const kickoff = new Date(m.date).getTime();
    if (kickoff < now) continue;
    if (nearest == null || kickoff < nearest) nearest = kickoff;
  }
  return nearest;
}

export function teamNeedsNewsRefresh(teamId: string): boolean {
  const now = Date.now();
  const kickoff = nextKickoffForTeam(teamId);
  if (kickoff == null) return false;
  if (kickoff - now > UPCOMING_WINDOW_MS) return false;

  const lastFetch = getLatestFetchAt(teamId);
  if (!lastFetch) return true;

  const age = now - new Date(lastFetch).getTime();
  const ttl = kickoff - now <= 24 * 60 * 60 * 1000 ? MATCHDAY_TTL_MS : NEWS_TTL_MS;
  return age >= ttl;
}

export function getTeamsNeedingNews(): string[] {
  const now = Date.now();
  const teamIds = new Set<string>();

  for (const m of getResolvedMatches()) {
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
    const kickoff = new Date(m.date).getTime();
    if (kickoff < now || kickoff > now + UPCOMING_WINDOW_MS) continue;
    teamIds.add(m.homeTeamId);
    teamIds.add(m.awayTeamId);
  }

  return [...teamIds].filter(teamNeedsNewsRefresh);
}

export async function pollTeamNews(
  teamId: string,
  options: { force?: boolean } = {},
): Promise<"synced" | "skipped" | "failed"> {
  if (!getTeam(teamId)) return "failed";
  if (!options.force && !teamNeedsNewsRefresh(teamId)) return "skipped";

  try {
    const snippets = await searchWeb(buildNewsQuery(teamId), { maxResults: 5 });
    if (snippets.length === 0) return "failed";

    const extracted = await extractTeamNews(teamId, snippets);
    if (!extracted) return "failed";

    const before = getTeamNewsSummary(teamId);
    if (shouldRejectEmptyNewsExtraction(before.events, extracted.events)) {
      return "skipped";
    }

    const nextFingerprint = teamNewsFingerprint(extracted.events);
    const prevFingerprint = teamNewsFingerprint(before.events);
    const changed = nextFingerprint !== prevFingerprint;

    const fetchedAt = new Date().toISOString();
    replaceTeamEvents(teamId, extracted.events, fetchedAt);
    setTeamNewsSummary(teamId, extracted.summary, fetchedAt);

    // News impact adjusts cached probabilities on read — no LLM re-run needed.
    if (changed && !isNewsImpactEnabled()) markTeamStale(teamId);
    return "synced";
  } catch {
    return "failed";
  }
}

export async function runNewsPollJob(): Promise<{
  polled: number;
  synced: number;
  skipped: number;
  failed: number;
}> {
  const targets = getTeamsNeedingNews();
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const teamId of targets) {
    const outcome = await pollTeamNews(teamId);
    if (outcome === "synced") synced += 1;
    else if (outcome === "skipped") skipped += 1;
    else failed += 1;
  }

  const { recordPollerRun } = await import("@/lib/ops/poller-heartbeat");
  recordPollerRun("news");

  return { polled: targets.length, synced, skipped, failed };
}
