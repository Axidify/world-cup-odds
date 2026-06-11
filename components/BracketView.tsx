"use client";

import Link from "next/link";
import { useState } from "react";
import { Flag } from "@/components/Flag";
import { SimulationPanel } from "@/components/SimulationPanel";
import { Card } from "@/components/ui/Card";
import type { OfficialBracketMatch } from "@/lib/bracket/official-knockout";
import { formatUtcDate, formatUtcDateTime } from "@/lib/utils/dates";
import { formatBracketSlot } from "@/lib/utils/slots";
import { formatStageLabel } from "@/lib/utils/match-label";
import type { KnockoutPathMatch, Match, MatchStage, PlayedMatchResult, Team } from "@/lib/types";

type ViewMode = "official" | "projected";

type BracketSlot = { home: string; away: string };

type Props = {
  knockout: Match[];
  bracketSlots: Record<string, BracketSlot>;
  officialPath: OfficialBracketMatch[];
  projectedPath?: KnockoutPathMatch[];
  confirmedScores: Record<string, PlayedMatchResult>;
  teams: Team[];
  officialChampionId?: string;
  projectedChampionId?: string;
  hasConfirmedKnockoutResults: boolean;
  hasConfirmedResults: boolean;
  hasSimulation: boolean;
  simulationRunAt: string | null;
  simulationStale: boolean;
  staleMessage: string | null;
};

const rounds: { stage: MatchStage; label: string }[] = [
  { stage: "r32", label: "Round of 32" },
  { stage: "r16", label: "Round of 16" },
  { stage: "qf", label: "Quarter-finals" },
  { stage: "sf", label: "Semi-finals" },
  { stage: "third_place", label: "Third place" },
  { stage: "final", label: "Final" },
];

function slotLabel(
  match: Match,
  bracketSlots: Map<string, BracketSlot>,
): string {
  const slot = bracketSlots.get(match.id);
  if (slot) return `${slot.home} vs ${slot.away}`;
  if (match.homeSlot && match.awaySlot) {
    return `${formatBracketSlot(match.homeSlot)} vs ${formatBracketSlot(match.awaySlot)}`;
  }
  return "TBD vs TBD";
}

export function BracketView({
  knockout,
  bracketSlots: bracketSlotsRecord,
  officialPath,
  projectedPath,
  confirmedScores,
  teams,
  officialChampionId,
  projectedChampionId,
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

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const bracketSlots = new Map(Object.entries(bracketSlotsRecord));
  const pathByMatch = new Map(
    (view === "official" ? officialPath : projectedPath ?? []).map((entry) => [entry.matchId, entry]),
  );
  const championId = view === "official" ? officialChampionId : projectedChampionId;
  const champion = championId ? teamMap.get(championId) : null;
  const confirmedKnockoutCount = knockout.filter((m) => confirmedScores[m.id]).length;

  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Knockout</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">Bracket</h1>
      <p className="mt-2 text-sm text-text-muted">
        {knockout.length} knockout slots
        {view === "projected" && simulationRunAt
          ? ` · projection from ${formatUtcDateTime(simulationRunAt)} UTC`
          : ""}
        {view === "official" && hasConfirmedKnockoutResults
          ? ` · ${confirmedKnockoutCount} confirmed result${confirmedKnockoutCount === 1 ? "" : "s"}`
          : ""}
        {champion ? ` · ${view === "official" ? "champion" : "projected champion"}: ${champion.name}` : ""}
        {view === "projected" && !champion ? " · run simulation to resolve teams" : ""}
      </p>

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
              <strong className="font-semibold text-text">Official</strong> bracket uses{" "}
              <strong className="font-semibold text-text">confirmed results only</strong>. Teams appear
              once the group stage is complete; later rounds fill in as knockout scores are confirmed.
              Unplayed matches stay as slot labels.
            </p>
          ) : (
            <p>
              No confirmed results yet. Match slots show seed labels until the tournament starts. Switch
              to <strong className="font-semibold text-text">Projected</strong> after running a
              tournament simulation.
            </p>
          )
        ) : projectedPath ? (
          <p>
            <strong className="font-semibold text-text">Projected</strong> bracket comes from your last
            simulation — real scores for finished matches plus AI&apos;s most likely outcomes for the
            rest. Re-run simulation after new results to refresh this view.
          </p>
        ) : (
          <p>
            Run a tournament simulation on the Dashboard to see a projected bracket. Match analysis must
            be complete first.
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

      <nav
        aria-label="Bracket rounds"
        className="sticky top-[60px] z-10 -mx-4 mt-6 flex gap-2 overflow-x-auto border-b border-border bg-bg px-4 py-2 md:hidden"
      >
        {rounds.map(({ stage, label }) => {
          const count = knockout.filter((m) => m.stage === stage).length;
          if (count === 0) return null;
          return (
            <a
              key={stage}
              href={`#bracket-${stage}`}
              className="num shrink-0 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-text-muted transition-colors hover:border-brand hover:text-brand"
            >
              {label}
            </a>
          );
        })}
      </nav>

      <div className="mt-8 space-y-10">
        {rounds.map(({ stage, label }) => {
          const matches = knockout.filter((m) => m.stage === stage);
          if (matches.length === 0) return null;

          return (
            <section key={stage} id={`bracket-${stage}`} className="scroll-mt-24">
              <h2 className="num mb-4 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                {label} · {matches.length} {matches.length === 1 ? "match" : "matches"}
              </h2>
              <div
                className={
                  matches.length > 4 ? "grid gap-3 sm:grid-cols-2" : "grid max-w-xl gap-3"
                }
              >
                {matches.map((m) => {
                  const resolved = pathByMatch.get(m.id);
                  const home = resolved ? teamMap.get(resolved.homeTeamId) : null;
                  const away = resolved ? teamMap.get(resolved.awayTeamId) : null;
                  const winnerId =
                    resolved && "winnerTeamId" in resolved ? resolved.winnerTeamId : undefined;
                  const winner = winnerId ? teamMap.get(winnerId) : null;
                  const result = confirmedScores[m.id];
                  const isProjected = view === "projected";
                  const showWinner = isProjected ? Boolean(winner) : Boolean(result && winner);

                  return (
                    <Link key={m.id} href={`/match/${m.id}`}>
                      <Card
                        className={`p-3 transition-colors hover:border-brand ${
                          resolved ? "border-solid" : "border-dashed opacity-90"
                        } ${isProjected && resolved && !result ? "border-brand/30" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase text-text-muted">
                            {formatStageLabel(m.stage, m.group)}
                          </span>
                          {result ? (
                            <span className="num text-[10px] font-semibold text-win">
                              {result.homeGoals}–{result.awayGoals} FT
                            </span>
                          ) : (
                            <span className="num text-[10px] text-text-muted">
                              {formatUtcDate(m.date)}
                            </span>
                          )}
                        </div>
                        {resolved && home && away ? (
                          <div className="mt-2 space-y-1 text-sm">
                            <div
                              className={`flex items-center gap-2 font-semibold ${
                                showWinner && winner?.id === home.id ? "text-brand" : ""
                              }`}
                            >
                              <Flag code={home.flagCode} alt={home.name} size="sm" />
                              {home.name}
                            </div>
                            <div
                              className={`flex items-center gap-2 font-semibold ${
                                showWinner && winner?.id === away.id ? "text-brand" : ""
                              }`}
                            >
                              <Flag code={away.flagCode} alt={away.name} size="sm" />
                              {away.name}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm font-semibold italic text-text-muted">
                            {slotLabel(m, bracketSlots)}
                          </p>
                        )}
                        <p className="mt-1 truncate text-xs text-text-muted">{m.venue}</p>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
