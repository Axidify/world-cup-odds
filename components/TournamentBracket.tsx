"use client";

import { useMemo, useState } from "react";
import { Flag } from "@/components/Flag";
import { ResultsSyncBanner } from "@/components/ResultsSyncBanner";
import { SimulationPanel } from "@/components/SimulationPanel";
import { GroupStagePanel } from "@/components/tournament/GroupStagePanel";
import { KnockoutBracketTree } from "@/components/tournament/KnockoutBracketTree";
import type { OfficialBracketMatch } from "@/lib/bracket/official-knockout";
import { buildBracketMatchDisplay } from "@/lib/bracket/match-display";
import { formatUtcDateTime, getLocalTimezoneName } from "@/lib/utils/dates";
import type {
  GroupAssignment,
  GroupStanding,
  KnockoutPathMatch,
  Match,
  PlayedMatchResult,
  Team,
} from "@/lib/types";

type ViewMode = "official" | "projected";

type BracketSlot = { home: string; away: string };

type Props = {
  groups: GroupAssignment[];
  knockout: Match[];
  bracketSlots: Record<string, BracketSlot>;
  officialStandings: Record<string, GroupStanding[]>;
  projectedStandings?: Record<string, GroupStanding[]>;
  officialPath: OfficialBracketMatch[];
  projectedPath?: KnockoutPathMatch[];
  confirmedScores: Record<string, PlayedMatchResult>;
  teams: Team[];
  officialChampionId?: string;
  projectedChampionId?: string;
  projectedChampionPct?: number;
  hasConfirmedKnockoutResults: boolean;
  hasConfirmedResults: boolean;
  hasSimulation: boolean;
  simulationRunAt: string | null;
  simulationStale: boolean;
  staleMessage: string | null;
};

export function TournamentBracket({
  groups,
  knockout,
  bracketSlots: bracketSlotsRecord,
  officialStandings,
  projectedStandings,
  officialPath,
  projectedPath,
  confirmedScores,
  teams,
  officialChampionId,
  projectedChampionId,
  projectedChampionPct,
  hasConfirmedKnockoutResults,
  hasConfirmedResults,
  hasSimulation,
  simulationRunAt,
  simulationStale,
  staleMessage,
}: Props) {
  const defaultView: ViewMode =
    hasConfirmedResults ? "official" : hasSimulation ? "projected" : "official";
  const [view, setView] = useState<ViewMode>(defaultView);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const bracketSlots = useMemo(
    () => new Map(Object.entries(bracketSlotsRecord)),
    [bracketSlotsRecord],
  );

  const pathByMatch = useMemo(
    () =>
      new Map(
        (view === "official" ? officialPath : projectedPath ?? []).map((entry) => [
          entry.matchId,
          entry,
        ]),
      ),
    [view, officialPath, projectedPath],
  );

  const standingsByGroup = view === "official" ? officialStandings : projectedStandings;

  const displays = useMemo(() => {
    const isProjected = view === "projected";
    const out = new Map<string, ReturnType<typeof buildBracketMatchDisplay>>();
    for (const m of knockout) {
      out.set(
        m.id,
        buildBracketMatchDisplay(m, {
          pathEntry: pathByMatch.get(m.id),
          confirmed: confirmedScores[m.id],
          bracketSlots,
          teamMap,
          isProjected,
        }),
      );
    }
    return out;
  }, [knockout, pathByMatch, confirmedScores, bracketSlots, teamMap, view]);

  const championId = view === "official" ? officialChampionId : projectedChampionId;
  const champion = championId ? teamMap.get(championId) : null;
  const confirmedKnockoutCount = knockout.filter((m) => confirmedScores[m.id]).length;

  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Tournament</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">
        World Cup bracket
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Groups and knockout progression
        {view === "projected" && simulationRunAt
          ? ` · projection from ${formatUtcDateTime(simulationRunAt)} UTC`
          : ""}
        {view === "official" && hasConfirmedKnockoutResults
          ? ` · ${confirmedKnockoutCount} confirmed knockout result${confirmedKnockoutCount === 1 ? "" : "s"}`
          : ""}
        {champion ? (
          <>
            {" "}
            · {view === "official" ? "Champion" : "Projected champion"}:{" "}
            <span className="inline-flex items-center gap-1 font-semibold text-text">
              {champion.flagCode && <Flag code={champion.flagCode} alt="" size="sm" />}
              {champion.name}
              {view === "projected" && projectedChampionPct != null ? (
                <span className="num text-brand">({projectedChampionPct.toFixed(1)}%)</span>
              ) : null}
            </span>
          </>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-text-muted" suppressHydrationWarning>
        Match times in your timezone ({getLocalTimezoneName()}). Highlighted: live, later today, or tomorrow.
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
          hasConfirmedResults ? (
            <p>
              <strong className="font-semibold text-text">Official</strong> progression from
              confirmed group results. Knockout teams fill in as the group stage completes; winners
              advance when scores are confirmed. Tap any match for details.
            </p>
          ) : (
            <p>
              No confirmed results yet. Group tables show FIFA seed order; knockout slots show seed
              labels until teams qualify.
            </p>
          )
        ) : projectedPath ? (
          <p>
            <strong className="font-semibold text-text">Projected</strong> bracket shows the most
            common knockout path from simulations where the top champion pick wins. Champion
            percentages use all simulation runs. Re-run after new results or predictions change.
          </p>
        ) : (
          <p>Run a tournament simulation on the Dashboard to see projected progression.</p>
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

      <div className="mt-8 flex flex-col gap-8">
        <GroupStagePanel
          layout="grid"
          groups={groups}
          teams={teams}
          standingsByGroup={standingsByGroup}
        />
        <div className="w-full min-w-0">
          <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Knockout bracket
          </h2>
          <KnockoutBracketTree
            knockout={knockout}
            displays={displays}
            champion={
              champion
                ? {
                    name: champion.name,
                    flagCode: champion.flagCode,
                    winPct: view === "projected" ? projectedChampionPct : undefined,
                  }
                : null
            }
            championLabel={view === "official" ? "Champion" : "Projected champion"}
          />
        </div>
      </div>
    </div>
  );
}
