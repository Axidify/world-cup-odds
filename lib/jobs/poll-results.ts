import type { Match } from "@/lib/types";
import { extractMatchResult } from "@/lib/ai/extract-result";
import { getTeamMap } from "@/lib/data/load";
import { getResolvedMatches } from "@/lib/data/resolved";
import { hasStablePendingScore } from "@/lib/results/apply-finished";
import { shouldDeferFtResultPoll } from "@/lib/results/confirm-guards";
import {
  isFootballDataConfigured,
  pollResultsFromFootballData,
  reconcileFootballDataConfirmedResults,
  fetchWorldCupMatches,
} from "@/lib/results/football-data";
import {
  isLinkedMatchFinishedOnFootballData,
  isLinkedMatchInPlayOnFootballData,
} from "@/lib/results/football-data/match-status";
import type { FootballDataMatch } from "@/lib/results/football-data/types";
import { snippetsAgreeOnScore } from "@/lib/results/score-agreement";
import { isSearchConfigured, searchWeb } from "@/lib/search/provider";
import { finalizeResultConfirmation } from "@/lib/results/on-confirm";
import { RESULT_POLL_START_AFTER_MS } from "@/lib/match/poll-timing";
import { getResult, isResultConfirmable, upsertPendingResult } from "@/lib/results/store";

export { RESULT_POLL_START_AFTER_MS };

export type ResultsProvider = "football-data" | "search";

export function resolveResultsProvider(): ResultsProvider {
  if (isFootballDataConfigured()) return "football-data";
  return "search";
}

export function resolveResultsProviderChain(): ResultsProvider[] {
  const chain: ResultsProvider[] = [];
  if (isFootballDataConfigured()) chain.push("football-data");
  if (isSearchConfigured()) chain.push("search");
  return chain.length > 0 ? chain : ["search"];
}

export function getMatchesNeedingResults(options: { backfill?: boolean } = {}): Match[] {
  const now = Date.now();
  return getResolvedMatches().filter((m) => {
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") return false;

    const kickoff = new Date(m.date).getTime();
    if (kickoff > now) return false;

    const existing = getResult(m.id);
    if (existing?.confirmed) return false;

    if (options.backfill) return true;
    return kickoff + RESULT_POLL_START_AFTER_MS <= now;
  });
}

function targetsStillNeedingResults(targets: Match[]): Match[] {
  return targets.filter((m) => !getResult(m.id)?.confirmed);
}

function buildSearchQueries(match: Match): string[] {
  const teamMap = getTeamMap();
  const home = teamMap.get(match.homeTeamId)?.name ?? match.homeTeamId;
  const away = teamMap.get(match.awayTeamId)?.name ?? match.awayTeamId;
  const day = match.date.slice(0, 10);
  return [
    `FIFA World Cup ${day} ${home} ${away} result FT`,
    `2026 FIFA World Cup ${home} vs ${away} final score ${day}`,
    `${home} ${away} World Cup 2026 full time score`,
  ];
}

async function searchMatchSnippets(match: Match) {
  const seen = new Set<string>();
  const snippets: Awaited<ReturnType<typeof searchWeb>> = [];

  for (const query of buildSearchQueries(match)) {
    const batch = await searchWeb(query, { maxResults: 5 });
    for (const snippet of batch) {
      const key = snippet.url || `${snippet.title}:${snippet.content.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      snippets.push(snippet);
    }
    if (snippets.length >= 8) break;
  }

  return snippets;
}

async function pollMatchResultFromSearch(
  matchId: string,
  apiMatches?: FootballDataMatch[] | null,
): Promise<"synced" | "confirmed" | "skipped" | "failed"> {
  const matches = getResolvedMatches();
  const match = matches.find((m) => m.id === matchId);
  if (!match) return "skipped";

  const existing = getResult(matchId);
  if (existing?.confirmed) return "skipped";

  if (shouldDeferFtResultPoll(match)) {
    console.warn(`[poller] results ${matchId}: match still in play, deferring search`);
    return "skipped";
  }

  if (isFootballDataConfigured()) {
    if (existing?.source?.includes("football-data")) {
      return "skipped";
    }

    if (apiMatches) {
      if (isLinkedMatchInPlayOnFootballData(match, apiMatches)) {
        console.warn(`[poller] results ${matchId}: football-data in-play, deferring search`);
        return "skipped";
      }
      if (isLinkedMatchFinishedOnFootballData(match, apiMatches)) {
        console.warn(`[poller] results ${matchId}: football-data finished, deferring search`);
        return "skipped";
      }
    } else {
      try {
        const wcMatches = await fetchWorldCupMatches();
        if (isLinkedMatchInPlayOnFootballData(match, wcMatches)) {
          console.warn(`[poller] results ${matchId}: football-data in-play, deferring search`);
          return "skipped";
        }
        if (isLinkedMatchFinishedOnFootballData(match, wcMatches)) {
          console.warn(`[poller] results ${matchId}: football-data finished, deferring search`);
          return "skipped";
        }
      } catch {
        // proceed with search if status check unavailable
      }
    }
  }

  try {
    const snippets = await searchMatchSnippets(match);
    if (snippets.length === 0) {
      console.warn(`[poller] results ${matchId}: no search snippets`);
      return "failed";
    }

    const extracted = await extractMatchResult(match, snippets);
    if (!extracted || extracted.homeScore < 0 || extracted.awayScore < 0) {
      console.warn(`[poller] results ${matchId}: could not extract score from ${snippets.length} snippets`);
      return "failed";
    }

    if (
      !snippetsAgreeOnScore(snippets, {
        homeScore: extracted.homeScore,
        awayScore: extracted.awayScore,
      })
    ) {
      console.warn(`[poller] results ${matchId}: score not agreed by multiple snippets`);
      return "failed";
    }

    const sourcePayload = JSON.stringify({
      provider: "search",
      urls: snippets.map((s) => s.url),
      extractedAt: new Date().toISOString(),
    });

    const scoreStable = hasStablePendingScore(matchId, {
      homeScore: extracted.homeScore,
      awayScore: extracted.awayScore,
    });

    upsertPendingResult({
      matchId: extracted.matchId,
      homeScore: extracted.homeScore,
      awayScore: extracted.awayScore,
      et: extracted.wentToExtraTime,
      pens: extracted.wentToPenalties,
      winnerTeamId: extracted.winnerTeamId,
      source: sourcePayload,
    });

    const row = getResult(matchId);
    if (!row || !isResultConfirmable(row)) {
      return "synced";
    }

    if (!scoreStable) {
      return "synced";
    }

    if (!finalizeResultConfirmation(matchId, "auto")) {
      return "failed";
    }
    return "confirmed";
  } catch (err) {
    console.warn(`[poller] results ${matchId}:`, err instanceof Error ? err.message : err);
    return "failed";
  }
}

export async function pollMatchResult(matchId: string): Promise<"synced" | "confirmed" | "skipped" | "failed"> {
  const chain = resolveResultsProviderChain().filter((p) => p !== "search");

  for (const provider of chain) {
    if (provider !== "football-data") continue;
    const summary = await pollResultsFromFootballData(
      getMatchesNeedingResults().filter((m) => m.id === matchId),
    );

    if (summary.confirmed > 0) return "confirmed";
    if (summary.synced > 0) return "synced";
    if (summary.failed > 0) return "failed";
  }

  return pollMatchResultFromSearch(matchId);
}

/** Re-fetch football-data for auto-confirmed rows (runs even when no fixtures need polling). */
export async function runResultsReconcileJob(): Promise<number> {
  if (!isFootballDataConfigured()) return 0;

  const fixed = await reconcileFootballDataConfirmedResults();
  if (fixed > 0) {
    const { scheduleAutoSimulation } = await import("@/lib/pipeline/auto-pipeline");
    scheduleAutoSimulation("poll_results");
  }
  return fixed;
}

export async function runResultsPollJob(options: { backfill?: boolean } = {}): Promise<{
  polled: number;
  confirmed: number;
  synced: number;
  failed: number;
  provider: ResultsProvider;
}> {
  const targets = getMatchesNeedingResults(options);
  const chain = resolveResultsProviderChain();
  let confirmed = 0;
  let synced = 0;
  let failed = 0;
  let wcMatches: FootballDataMatch[] | null = null;

  try {
    if (isFootballDataConfigured()) {
      try {
        wcMatches = await fetchWorldCupMatches();
      } catch (err) {
        console.warn(
          "[poller] results:",
          err instanceof Error ? err.message : err,
        );
      }

      if (targets.length === 0) {
        confirmed += await reconcileFootballDataConfirmedResults({
          apiMatches: wcMatches ?? undefined,
        });
      }
    }

    let remaining = targets;

    if (isFootballDataConfigured() && isSearchConfigured() && targets.length > 0 && !wcMatches) {
      try {
        wcMatches = await fetchWorldCupMatches();
      } catch (err) {
        console.warn(
          "[poller] results:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    for (const provider of chain) {
      remaining = targetsStillNeedingResults(remaining);
      if (remaining.length === 0) break;

      if (provider === "football-data") {
        const summary = await pollResultsFromFootballData(
          remaining,
          wcMatches ?? undefined,
        );
        confirmed += summary.confirmed;
        synced += summary.synced;
        failed += summary.failed;
        continue;
      }

      for (const match of remaining) {
        const outcome = await pollMatchResultFromSearch(match.id, wcMatches ?? undefined);
        if (outcome === "confirmed") confirmed += 1;
        else if (outcome === "synced") synced += 1;
        else if (outcome === "failed") failed += 1;
      }
      break;
    }

    if (confirmed > 0) {
      const { scheduleAutoSimulation } = await import("@/lib/pipeline/auto-pipeline");
      scheduleAutoSimulation("poll_results");
    }

    return {
      polled: targets.length,
      confirmed,
      synced,
      failed,
      provider: resolveResultsProvider(),
    };
  } finally {
    const { recordPollerRun } = await import("@/lib/ops/poller-heartbeat");
    recordPollerRun("results");
  }
}
