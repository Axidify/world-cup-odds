"use client";

import { useMemo, useState } from "react";
import { GroupCard } from "@/components/GroupCard";
import { ResultsSyncBanner } from "@/components/ResultsSyncBanner";
import { SimulationPanel } from "@/components/SimulationPanel";
import { formatUtcDateTime, getLocalTimezoneName } from "@/lib/utils/dates";
import type { GroupAssignment, GroupStanding, Match, PlayedMatchResult, Team } from "@/lib/types";

type ViewMode = "official" | "projected";

type Props = {
  groups: GroupAssignment[];
  teams: Team[];
  fixtures: Match[];
  officialStandings: Record<string, GroupStanding[]>;
  projectedStandings?: Record<string, GroupStanding[]>;
  projectedScores?: Record<string, PlayedMatchResult>;
  confirmedScores: Record<string, PlayedMatchResult>;
  hasConfirmedGroupResults: boolean;
  simulationRunAt: string | null;
  simulationStale: boolean;
  staleMessage: string | null;
  hasSimulation: boolean;
};

export function GroupsView({
  groups,
  teams,
  fixtures,
  officialStandings,
  projectedStandings,
  projectedScores = {},
  confirmedScores,
  hasConfirmedGroupResults,
  simulationRunAt,
  simulationStale,
  staleMessage,
  hasSimulation,
}: Props) {
  const defaultView: ViewMode =
    hasConfirmedGroupResults ? "official" : hasSimulation ? "projected" : "official";
  const [view, setView] = useState<ViewMode>(defaultView);

  const confirmedMap = useMemo(
    () => new Map(Object.entries(confirmedScores)),
    [confirmedScores],
  );
  const projectedMap = useMemo(
    () => new Map(Object.entries(projectedScores)),
    [projectedScores],
  );

  const standingsByGroup = view === "official" ? officialStandings : projectedStandings;
  const confirmedGroupMatches = fixtures.filter((f) => confirmedScores[f.id]).length;

  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Group Stage</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">Group standings</h1>
      <p className="mt-2 text-sm text-text-muted">
        12 groups · {fixtures.length} group-stage matches
        {view === "projected" && simulationRunAt
          ? ` · projection from ${formatUtcDateTime(simulationRunAt)} UTC`
          : ""}
        {view === "official" && hasConfirmedGroupResults
          ? ` · ${confirmedGroupMatches} confirmed result${confirmedGroupMatches === 1 ? "" : "s"}`
          : ""}
      </p>
      <p className="mt-1 text-xs text-text-muted" suppressHydrationWarning>
        Fixture times in your timezone ({getLocalTimezoneName()}). Highlighted: live, later today, or tomorrow.
      </p>

      <div className="mt-4">
        <ResultsSyncBanner />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["official", "projected"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setView(mode)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
              view === mode
                ? "bg-brand text-[oklch(0.16_0.02_250)]"
                : "bg-surface-2 text-text-muted hover:text-text"
            }`}
          >
            {mode === "official" ? "Official" : "Projected"}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-sm text-text-muted">
        {view === "official" ? (
          hasConfirmedGroupResults ? (
            <p>
              <strong className="font-semibold text-text">Official</strong> tables use{" "}
              <strong className="font-semibold text-text">confirmed results only</strong>. They update
              automatically when scores are confirmed — no simulation needed. Unplayed matches stay at
              zero points.
            </p>
          ) : (
            <p>
              No confirmed group-stage results yet. Tables show teams ranked by FIFA seed order until
              matches finish. Switch to <strong className="font-semibold text-text">Projected</strong>{" "}
              after running a tournament simulation.
            </p>
          )
        ) : projectedStandings ? (
          <p>
            <strong className="font-semibold text-text">Projected</strong> tables and fixture scores
            come from your last simulation — confirmed FT results plus the most likely AI scoreline
            for unplayed group matches (<span className="num">proj</span>). Re-run simulation after
            new results to refresh.
          </p>
        ) : (
          <p>
            Run a tournament simulation on the Dashboard to see projected group tables. Match analysis
            must be complete first.
          </p>
        )}
      </div>

      {view === "projected" && (
        <>
          {staleMessage && (
            <p className="mt-3 text-xs font-semibold text-loss" role="status">
              {staleMessage}
            </p>
          )}
          {(!hasSimulation || simulationStale) && (
            <div className="mt-4">
              <SimulationPanel hasSimulation={hasSimulation} lastRunAt={simulationRunAt} />
            </div>
          )}
        </>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <GroupCard
            key={g.group}
            group={g}
            teams={teams}
            fixtures={fixtures}
            standings={standingsByGroup?.[g.group]}
            confirmedScores={confirmedMap}
            projectedScores={projectedMap}
            showProjectedScores={view === "projected" && hasSimulation}
            showFixtures
          />
        ))}
      </div>
    </div>
  );
}
