import { NextResponse } from "next/server";
import { getTeamMap } from "@/lib/data/load";
import { getResolvedMatches } from "@/lib/data/resolved";
import { getResultsPollPlan } from "@/lib/jobs/poll-schedule";
import {
  getMatchLifecycle,
  getResultsCheckAtMs,
} from "@/lib/match/lifecycle";
import { getSimulationStaleState, getLatestSimulation } from "@/lib/sim/simulation-cache";
import { formatSimulationStaleMessage } from "@/lib/sim/stale-messages";
import { getPendingResults, getResult } from "@/lib/results/store";
import { getPollerStatus } from "@/lib/ops/poller-heartbeat";
import { getPipelineConfig } from "@/lib/pipeline/config";
import { isPipelineActive } from "@/lib/pipeline/auto-pipeline";
import { getPipelineState } from "@/lib/pipeline/pipeline-state";
import { getDb } from "@/lib/db";
import { resolveResultsProvider } from "@/lib/jobs/poll-results";

export const dynamic = "force-dynamic";

export async function GET() {
  getDb();
  const simulation = getLatestSimulation();
  const staleState = getSimulationStaleState();
  const pending = getPendingResults();
  const poller = getPollerStatus();
  const now = Date.now();
  const intervalMinutes = Number(process.env.RESULTS_POLL_INTERVAL_MINUTES ?? 15);
  const resultsPollPlan = getResultsPollPlan(intervalMinutes * 60_000, now);
  const teamMap = getTeamMap();

  let liveCount = 0;
  let awaitingCount = 0;
  const activeMatches: Array<{
    matchId: string;
    label: string;
    lifecycle: "live" | "awaiting_result";
    kickoff: string;
    resultsCheckAt: string;
  }> = [];

  for (const match of getResolvedMatches()) {
    if (match.homeTeamId === "TBD" || match.awayTeamId === "TBD") continue;
    const confirmed = Boolean(getResult(match.id)?.confirmed);
    const lifecycle = getMatchLifecycle(match.date, confirmed, now);
    if (lifecycle === "live") liveCount += 1;
    if (lifecycle === "awaiting_result") awaitingCount += 1;
    if (lifecycle === "live" || lifecycle === "awaiting_result") {
      const home = teamMap.get(match.homeTeamId)?.name ?? match.homeTeamId;
      const away = teamMap.get(match.awayTeamId)?.name ?? match.awayTeamId;
      activeMatches.push({
        matchId: match.id,
        label: `${home} vs ${away}`,
        lifecycle,
        kickoff: match.date,
        resultsCheckAt: new Date(getResultsCheckAtMs(match.date)).toISOString(),
      });
    }
  }

  activeMatches.sort((a, b) => {
    if (a.lifecycle !== b.lifecycle) {
      return a.lifecycle === "live" ? -1 : 1;
    }
    return a.kickoff.localeCompare(b.kickoff);
  });

  return NextResponse.json({
    resultsProvider: resolveResultsProvider(),
    simulation: simulation
      ? { runAt: simulation.runAt, provider: simulation.provider, model: simulation.model }
      : null,
    stale: staleState,
    staleMessage: formatSimulationStaleMessage(staleState),
    pendingResults: pending.length,
    poller,
    resultsPoll: {
      shouldPoll: resultsPollPlan.shouldPoll,
      nextPollAt: new Date(resultsPollPlan.nextPollAt).toISOString(),
      reason: resultsPollPlan.reason,
      intervalMinutes,
    },
    matchActivity: {
      liveCount,
      awaitingCount,
      matches: activeMatches.slice(0, 6),
    },
    pipeline: {
      config: getPipelineConfig(),
      state: getPipelineState(),
      active: isPipelineActive(),
    },
  });
}
