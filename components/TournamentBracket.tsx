"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
type ProjectedStoryMode = "representative" | "sample";

type SamplePathResponse = {
  index: number;
  iterations: number;
  groupStandings: Record<string, GroupStanding[]>;
  knockout: KnockoutPathMatch[];
  championTeamId: string;
  championOddsPct: number;
};

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
  modalGroupStandings?: Record<string, import("@/lib/types").GroupStanding[]>;
  representativePathNote?: string | null;
  championOdds?: Record<string, number>;
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
  modalGroupStandings,
  representativePathNote,
  championOdds,
}: Props) {
  const defaultView: ViewMode =
    hasConfirmedResults ? "official" : hasSimulation ? "projected" : "official";
  const [view, setView] = useState<ViewMode>(defaultView);
  const [storyMode, setStoryMode] = useState<ProjectedStoryMode>("representative");
  const [sample, setSample] = useState<SamplePathResponse | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const loadSample = useCallback(async (index?: number) => {
    setSampleLoading(true);
    setSampleError(null);
    try {
      const url =
        index != null
          ? `/api/simulation/sample-path?index=${index}`
          : "/api/simulation/sample-path";
      const res = await fetch(url);
      const data = (await res.json()) as SamplePathResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load sample");
      setSample(data);
    } catch (err) {
      setSampleError(err instanceof Error ? err.message : "Could not load sample");
    } finally {
      setSampleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "projected" && storyMode === "sample" && !sample && !sampleLoading) {
      void loadSample();
    }
  }, [view, storyMode, sample, sampleLoading, loadSample]);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const bracketSlots = useMemo(
    () => new Map(Object.entries(bracketSlotsRecord)),
    [bracketSlotsRecord],
  );

  const projectedKnockoutPath =
    storyMode === "sample" && sample ? sample.knockout : projectedPath;

  const pathByMatch = useMemo(
    () =>
      new Map(
        (view === "official" ? officialPath : projectedKnockoutPath ?? []).map((entry) => [
          entry.matchId,
          entry,
        ]),
      ),
    [view, officialPath, projectedKnockoutPath],
  );

  const standingsByGroup =
    view === "official"
      ? officialStandings
      : storyMode === "sample" && sample
        ? sample.groupStandings
        : modalGroupStandings ?? projectedStandings;

  const activeProjectedChampionId =
    storyMode === "sample" && sample ? sample.championTeamId : projectedChampionId;
  const activeProjectedChampionPct =
    storyMode === "sample" && sample
      ? sample.championOddsPct
      : projectedChampionPct;

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

  const championId = view === "official" ? officialChampionId : activeProjectedChampionId;
  const champion = championId ? teamMap.get(championId) : null;
  const championWinPct =
    view === "projected"
      ? activeProjectedChampionPct ?? (championId ? championOdds?.[championId] : undefined)
      : undefined;
  const confirmedKnockoutCount = knockout.filter((m) => confirmedScores[m.id]).length;
  const leaderName = projectedChampionId ? teamMap.get(projectedChampionId)?.name : null;

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
            · {view === "official" ? "Champion" : storyMode === "sample" ? "Simulated champion" : "Example champion"}:{" "}
            <span className="inline-flex items-center gap-1 font-semibold text-text">
              {champion.flagCode && <Flag code={champion.flagCode} alt="" size="sm" />}
              {champion.name}
              {view === "projected" && championWinPct != null ? (
                <span className="num text-brand">({championWinPct.toFixed(1)}% title odds)</span>
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
            {mode === "official" ? "Official" : "Simulated"}
          </button>
        ))}
      </div>

      {view === "projected" && projectedPath && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(
            [
              { id: "representative" as const, label: leaderName ? `If ${leaderName} wins` : "Leader path" },
              { id: "sample" as const, label: "Random draw" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setStoryMode(id);
                if (id === "sample" && !sample) void loadSample();
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                storyMode === id
                  ? "border-brand bg-brand-tint/30 text-text"
                  : "border-border bg-surface text-text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
          {storyMode === "sample" && (
            <button
              type="button"
              disabled={sampleLoading}
              onClick={() => void loadSample()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text disabled:opacity-60"
            >
              {sampleLoading ? <Loader2 size={12} className="animate-spin" /> : null}
              Another simulation
            </button>
          )}
          {storyMode === "sample" && sample && !sampleLoading ? (
            <span className="num text-xs text-text-muted">
              Draw #{sample.index + 1} of {sample.iterations.toLocaleString()}
            </span>
          ) : null}
        </div>
      )}

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
        ) : projectedKnockoutPath ? (
          storyMode === "sample" ? (
            <p>
              <strong className="font-semibold text-text">Random draw</strong> — one complete
              simulated tournament. The chance of this exact bracket is far below each team&apos;s
              champion odds shown above.
              {sampleError ? (
                <span className="mt-1 block text-loss">{sampleError}</span>
              ) : null}
            </p>
          ) : (
            <p>
              <strong className="font-semibold text-text">Example path</strong> —{" "}
              {representativePathNote ??
                "Knockout tree from simulations. Group tables show the most frequent finisher per position."}
            </p>
          )
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
                    winPct: view === "projected" ? championWinPct : undefined,
                  }
                : null
            }
            championLabel={
              view === "official"
                ? "Champion"
                : storyMode === "sample"
                  ? "Simulated champion"
                  : "Example champion"
            }
          />
        </div>
      </div>
    </div>
  );
}
