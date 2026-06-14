"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flag } from "@/components/Flag";
import { MatchStatusBadge } from "@/components/MatchStatusBadge";
import type { BracketMatchDisplay } from "@/lib/bracket/match-display";
import { getKickoffHighlight, kickoffHighlightCardClass } from "@/lib/match/kickoff-highlight";
import { getMatchLifecycle } from "@/lib/match/lifecycle";
import { MATCH_CARD_HEIGHT } from "@/lib/bracket/tree-layout";
import { formatLocalDate } from "@/lib/utils/dates";
import { teamAbbrev } from "@/lib/match/fixture-probs-display";

type Props = {
  match: BracketMatchDisplay;
  columnWidth: number;
};

function TeamRow({
  line,
  isWinner,
  goals,
  advancePct,
  compactTeams,
}: {
  line: { name: string; flagCode: string };
  isWinner: boolean;
  goals: number | null;
  advancePct?: number | null;
  compactTeams: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 ${
        isWinner ? "text-brand" : "text-text"
      }`}
    >
      <Flag code={line.flagCode} alt={line.name} size="sm" />
      <span
        className={`truncate text-xs ${isWinner ? "font-bold" : "font-semibold"}`}
        title={compactTeams ? line.name : undefined}
      >
        {compactTeams ? teamAbbrev(line.name) : line.name}
      </span>
      {goals != null ? (
        <span className="num ml-auto shrink-0 text-xs font-bold tabular-nums">{goals}</span>
      ) : advancePct != null ? (
        <span
          className={`num ml-auto shrink-0 text-[10px] font-bold tabular-nums ${isWinner ? "text-brand" : "text-text-muted"}`}
          title="Model advance probability (win share plus half of draw mass). Simulated winner highlighted."
        >
          {advancePct.toFixed(0)}%
        </span>
      ) : null}
    </div>
  );
}

export function BracketMatchNode({ match, columnWidth }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const hasScore = Boolean(match.score);
  const showLeftDate = hasScore || match.projected;
  const lifecycle = getMatchLifecycle(match.date, hasScore, now);
  const highlight = getKickoffHighlight(match.date, lifecycle, now);
  const highlightClass = !match.projected ? kickoffHighlightCardClass(highlight) : "";
  const compactTeams = columnWidth < 148;
  const showLiveStatus = lifecycle === "live" || lifecycle === "awaiting_result";

  return (
    <Link
      href={`/match/${match.matchId}`}
      className="group block"
      style={{ width: columnWidth }}
    >
      <div
        className={`flex flex-col justify-center gap-1 rounded-lg border bg-surface-1 px-2.5 py-1.5 transition-colors group-hover:border-brand ${
          match.home && match.away ? "border-border" : "border-dashed border-border/70"
        } ${match.projected ? "border-brand/30" : ""} ${highlightClass}`}
        style={{ height: MATCH_CARD_HEIGHT }}
        suppressHydrationWarning
      >
        <div className="flex items-center justify-between gap-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
          {showLeftDate ? (
            <span suppressHydrationWarning>{formatLocalDate(match.date)}</span>
          ) : (
            <span />
          )}
          {hasScore ? (
            <span className="text-win">FT</span>
          ) : showLiveStatus ? (
            <MatchStatusBadge matchId={match.matchId} kickoffIso={match.date} compact />
          ) : match.projected ? (
            <span className="text-brand">model</span>
          ) : (
            <MatchStatusBadge matchId={match.matchId} kickoffIso={match.date} compact />
          )}
        </div>

        {match.home && match.away ? (
          <div className="space-y-0.5">
            <TeamRow
              line={match.home}
              isWinner={match.winnerId === match.home.teamId}
              goals={match.score ? match.score.home : null}
              advancePct={match.advancePct?.home}
              compactTeams={compactTeams}
            />
            <TeamRow
              line={match.away}
              isWinner={match.winnerId === match.away.teamId}
              goals={match.score ? match.score.away : null}
              advancePct={match.advancePct?.away}
              compactTeams={compactTeams}
            />
          </div>
        ) : (
          <p className="truncate text-[11px] italic text-text-muted">{match.slotLabel}</p>
        )}
      </div>
    </Link>
  );
}
