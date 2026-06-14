"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flag } from "@/components/Flag";
import { formatLiveMinuteDisplay } from "@/lib/match/live-minute";
import { useLiveScore } from "@/components/LiveScoresProvider";

export type DashboardLiveMatch = {
  matchId: string;
  kickoffIso: string;
  homeName: string;
  awayName: string;
  homeFlagCode: string;
  awayFlagCode: string;
  group?: string | null;
  stage: string;
};

type Props = {
  match: DashboardLiveMatch;
  /** Larger score typography for the hero countdown card. */
  prominent?: boolean;
};

export function DashboardLiveMatchRow({ match, prominent = false }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const live = useLiveScore(match.matchId);
  const minuteLabel = formatLiveMinuteDisplay(live, match.kickoffIso, now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Link
      href={`/match/${match.matchId}`}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-loss/30 bg-surface/60 px-3 py-3 transition-colors hover:border-loss/50 hover:bg-surface-2 ${
        prominent ? "sm:px-4 sm:py-4" : ""
      }`}
    >
      <span className="flex min-w-0 items-center gap-2 font-semibold">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-loss opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-loss" />
        </span>
        <Flag code={match.homeFlagCode} alt={match.homeName} size="sm" />
        <span className="truncate">{match.homeName}</span>
        <span className="text-text-muted">vs</span>
        <Flag code={match.awayFlagCode} alt={match.awayName} size="sm" />
        <span className="truncate">{match.awayName}</span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        {live ? (
          <>
            <span
              className={`num font-extrabold tracking-tight text-loss ${
                prominent ? "text-2xl sm:text-3xl" : "text-lg"
              }`}
            >
              {live.homeScore}
              <span className="mx-1.5 text-text-muted">–</span>
              {live.awayScore}
            </span>
            {minuteLabel ? (
              <span className="num text-xs font-semibold uppercase tracking-wide text-text-muted">
                {minuteLabel}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-xs font-semibold text-text-muted">Syncing score…</span>
        )}
        <span className="num hidden text-[10px] uppercase text-text-muted sm:inline">
          {match.group ? `Gp ${match.group}` : match.stage}
        </span>
      </span>
    </Link>
  );
}
