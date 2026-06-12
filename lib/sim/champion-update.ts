import type { ChampionOddsMap, SimulationResult } from "@/lib/types";
import {
  getLatestSimulation,
  getPreviousSimulation,
  getSimulationStaleState,
  type SimulationStaleState,
} from "@/lib/sim/simulation-cache";
import { listConfirmedBetween } from "@/lib/results/confirmed-stats";
import { isPipelineActive } from "@/lib/pipeline/auto-pipeline";
import { formatSimulationStaleMessage } from "@/lib/sim/stale-messages";
import { formatUtcDateTime } from "@/lib/utils/dates";

export type ChampionOddsChange = {
  teamId: string;
  before: number;
  after: number;
  delta: number;
};

export type ChampionUpdateContext = {
  status: "no_simulation" | "baseline" | "stale" | "updated";
  before: SimulationResult | null;
  after: SimulationResult | null;
  beforeOdds: ChampionOddsMap | null;
  afterOdds: ChampionOddsMap | null;
  staleState: SimulationStaleState;
  pipelineActive: boolean;
  confirmedTriggers: Array<{ matchId: string; label: string; score: string; confirmedAt: string }>;
  reasons: string[];
  topMovers: ChampionOddsChange[];
};

export function diffChampionOdds(
  before: ChampionOddsMap,
  after: ChampionOddsMap,
  teamIds: string[],
): ChampionOddsChange[] {
  return teamIds
    .map((teamId) => {
      const b = before[teamId] ?? 0;
      const a = after[teamId] ?? 0;
      return { teamId, before: b, after: a, delta: a - b };
    })
    .filter((row) => Math.abs(row.delta) >= 0.05)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function formatRunAt(iso: string): string {
  return `${formatUtcDateTime(iso)} UTC`;
}

function buildResultLines(
  results: Array<{ label: string; score: string }>,
): string[] {
  if (results.length === 0) return [];
  return results.map((r) => `${r.label} finished ${r.score}`);
}

export function getChampionUpdateContext(): ChampionUpdateContext {
  const after = getLatestSimulation();
  const before = getPreviousSimulation();
  const staleState = getSimulationStaleState();
  const pipelineActive = isPipelineActive();

  const empty: ChampionUpdateContext = {
    status: "no_simulation",
    before: null,
    after: null,
    beforeOdds: null,
    afterOdds: null,
    staleState,
    pipelineActive,
    confirmedTriggers: [],
    reasons: ["Run match analysis, then simulate the tournament to generate champion odds."],
    topMovers: [],
  };

  if (!after) return empty;

  if (staleState.stale) {
    const confirmedTriggers = listConfirmedBetween(after.runAt);
    const staleMessage = formatSimulationStaleMessage(staleState);
    const reasons: string[] = [
      `Showing odds from ${formatRunAt(after.runAt)} — newer information is not reflected yet.`,
    ];
    if (staleMessage) reasons.push(staleMessage);
    if (confirmedTriggers.length > 0) {
      reasons.push(
        `Confirmed since that run: ${buildResultLines(confirmedTriggers).join("; ")}.`,
      );
      reasons.push(
        "Each confirmed score removes impossible bracket paths and fixes group standings, so champion probabilities should shift once simulation re-runs.",
      );
    }
    if (pipelineActive) {
      reasons.push("Auto-pipeline is updating the simulation now — refresh in a moment.");
    }

    return {
      status: "stale",
      before: after,
      after: null,
      beforeOdds: after.championOdds,
      afterOdds: null,
      staleState,
      pipelineActive,
      confirmedTriggers,
      reasons,
      topMovers: [],
    };
  }

  if (!before) {
    return {
      status: "baseline",
      before: null,
      after,
      beforeOdds: null,
      afterOdds: after.championOdds,
      staleState,
      pipelineActive,
      confirmedTriggers: [],
      reasons: [
        `Baseline simulation from ${formatRunAt(after.runAt)}.`,
        "After future results confirm, the auto-pipeline re-runs Monte Carlo with those scores locked in and compares to this run.",
      ],
      topMovers: [],
    };
  }

  const confirmedTriggers = listConfirmedBetween(before.runAt, after.runAt);
  const topMovers = diffChampionOdds(before.championOdds, after.championOdds, Object.keys(after.championOdds));

  const reasons: string[] = [
    `Updated ${formatRunAt(after.runAt)} (was ${formatRunAt(before.runAt)}).`,
  ];

  if (confirmedTriggers.length > 0) {
    reasons.push(
      `Triggered by ${confirmedTriggers.length} confirmed result${confirmedTriggers.length === 1 ? "" : "s"}: ${buildResultLines(confirmedTriggers).join("; ")}.`,
    );
    reasons.push(
      "The simulator keeps confirmed scores fixed and re-rolls only unplayed matches, so teams eliminated or weakened in the bracket lose champion equity.",
    );
  } else if (staleState.predictionsNewerThanRun) {
    reasons.push("Match predictions changed since the prior simulation — odds were refreshed without new confirmed scores.");
  } else {
    reasons.push("Manual re-simulation or pipeline startup refreshed the odds.");
  }

  const eliminated = topMovers.filter((m) => m.before >= 0.5 && m.after < 0.05);
  if (eliminated.length > 0) {
    reasons.push(
      `${eliminated.length} team${eliminated.length === 1 ? "" : "s"} dropped to near-zero after the update (likely knocked out or path closed).`,
    );
  }

  return {
    status: "updated",
    before,
    after,
    beforeOdds: before.championOdds,
    afterOdds: after.championOdds,
    staleState,
    pipelineActive,
    confirmedTriggers,
    reasons,
    topMovers: topMovers.slice(0, 8),
  };
}
