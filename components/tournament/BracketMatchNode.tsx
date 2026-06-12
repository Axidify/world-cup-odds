import Link from "next/link";
import { Flag } from "@/components/Flag";
import { MatchStatusBadge } from "@/components/MatchStatusBadge";
import type { BracketMatchDisplay } from "@/lib/bracket/match-display";
import { MATCH_CARD_HEIGHT } from "@/lib/bracket/tree-layout";
import { formatUtcDate } from "@/lib/utils/dates";

type Props = {
  match: BracketMatchDisplay;
  columnWidth: number;
};

function TeamRow({
  line,
  isWinner,
  goals,
}: {
  line: { name: string; flagCode: string };
  isWinner: boolean;
  goals: number | null;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 ${
        isWinner ? "text-brand" : "text-text"
      }`}
    >
      <Flag code={line.flagCode} alt={line.name} size="sm" />
      <span className={`truncate text-xs ${isWinner ? "font-bold" : "font-semibold"}`}>
        {line.name}
      </span>
      {goals != null && (
        <span className="num ml-auto shrink-0 text-xs font-bold tabular-nums">{goals}</span>
      )}
    </div>
  );
}

export function BracketMatchNode({ match, columnWidth }: Props) {
  const hasScore = Boolean(match.score);
  const showLeftDate = hasScore || match.projected;

  return (
    <Link
      href={`/match/${match.matchId}`}
      className="group block"
      style={{ width: columnWidth }}
    >
      <div
        className={`flex flex-col justify-center gap-1 rounded-lg border bg-surface-1 px-2.5 py-1.5 transition-colors group-hover:border-brand ${
          match.home && match.away ? "border-border" : "border-dashed border-border/70"
        } ${match.projected ? "border-brand/30" : ""}`}
        style={{ height: MATCH_CARD_HEIGHT }}
      >
        <div className="flex items-center justify-between gap-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
          {showLeftDate ? <span>{formatUtcDate(match.date)}</span> : <span />}
          {hasScore ? (
            <span className="text-win">FT</span>
          ) : match.projected ? (
            <span className="text-brand">proj</span>
          ) : (
            <MatchStatusBadge kickoffIso={match.date} compact />
          )}
        </div>

        {match.home && match.away ? (
          <div className="space-y-0.5">
            <TeamRow
              line={match.home}
              isWinner={match.winnerId === match.home.teamId}
              goals={match.score ? match.score.home : null}
            />
            <TeamRow
              line={match.away}
              isWinner={match.winnerId === match.away.teamId}
              goals={match.score ? match.score.away : null}
            />
          </div>
        ) : (
          <p className="truncate text-[11px] italic text-text-muted">{match.slotLabel}</p>
        )}
      </div>
    </Link>
  );
}
