"use client";

import { useEffect, useState } from "react";
import {
  getKickoffHighlight,
  kickoffHighlightLabel,
} from "@/lib/match/kickoff-highlight";
import {
  formatLifecycleLabelLocal,
  getMatchLifecycle,
  type MatchLifecycle,
} from "@/lib/match/lifecycle";
import { formatUpcomingKickoffCompact } from "@/lib/utils/dates";
import { formatLiveMinuteDisplay } from "@/lib/match/live-minute";
import { useLiveScore } from "@/components/LiveScoresProvider";

type ScoreLine = { homeGoals: number; awayGoals: number };

type WinProbs = { home: number; draw: number; away: number };

type Props = {
  matchId?: string;
  kickoffIso: string;
  confirmed?: ScoreLine | null;
  /** Modal simulation score for unplayed group fixtures (projected view). */
  projected?: ScoreLine | null;
  /** Model 1X2 probabilities for unplayed group fixtures. */
  projectedProbs?: WinProbs | null;
  compact?: boolean;
};

const BADGE_CLASS: Record<MatchLifecycle, string> = {
  upcoming: "text-text-muted",
  live: "text-loss font-semibold",
  awaiting_result: "text-money font-semibold",
  confirmed: "text-win font-semibold",
};

export function MatchStatusBadge({
  matchId,
  kickoffIso,
  confirmed,
  projected,
  projectedProbs,
  compact = false,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const live = useLiveScore(matchId ?? "");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lifecycle = getMatchLifecycle(kickoffIso, Boolean(confirmed), now);
  const liveScore =
    live != null ? { home: live.homeScore, away: live.awayScore } : null;
  const minuteLabel = formatLiveMinuteDisplay(live, kickoffIso, now);

  if (lifecycle === "confirmed" && confirmed) {
    return (
      <span className={`num shrink-0 ${BADGE_CLASS.confirmed}`}>
        {confirmed.homeGoals}–{confirmed.awayGoals}{" "}
        <span className="text-[10px] font-normal uppercase tracking-wide">FT</span>
      </span>
    );
  }

  if (lifecycle === "live" && liveScore) {
    return (
      <span className={`num shrink-0 flex items-center gap-1.5 ${BADGE_CLASS.live}`}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-loss opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-loss" />
        </span>
        {liveScore.home}–{liveScore.away}
        {minuteLabel ? (
          <span className="text-[10px] font-normal uppercase tracking-wide text-text-muted">
            {minuteLabel}
          </span>
        ) : null}
      </span>
    );
  }

  if (projectedProbs && lifecycle !== "live") {
    return (
      <span className="num shrink-0 font-semibold text-brand" title={`Home ${projectedProbs.home}% · Draw ${projectedProbs.draw}% · Away ${projectedProbs.away}%`}>
        {projectedProbs.home}·{projectedProbs.draw}·{projectedProbs.away}
        <span className="text-[10px] font-normal uppercase tracking-wide text-text-muted"> %</span>
      </span>
    );
  }

  if (projected && lifecycle !== "live") {
    return (
      <span className="num shrink-0 font-semibold text-brand">
        {projected.homeGoals}–{projected.awayGoals}{" "}
        <span className="text-[10px] font-normal uppercase tracking-wide text-text-muted">proj</span>
      </span>
    );
  }

  const highlight = getKickoffHighlight(kickoffIso, lifecycle, now);
  const label = formatLifecycleLabelLocal(lifecycle, kickoffIso, now, undefined, liveScore);

  if (lifecycle === "live") {
    return (
      <span className={`num shrink-0 flex items-center gap-1.5 ${BADGE_CLASS.live}`}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-loss opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-loss" />
        </span>
        {compact ? "Live" : label}
      </span>
    );
  }

  if (compact) {
    const compactLabel =
      lifecycle === "awaiting_result"
        ? "Syncing…"
        : lifecycle === "upcoming"
          ? formatUpcomingKickoffCompact(
              kickoffIso,
              highlight === "later_today" || highlight === "tomorrow" ? highlight : null,
            )
          : label;
    const dayLabel = kickoffHighlightLabel(highlight);
    const emphasizeDay = lifecycle === "upcoming" && dayLabel;
    return (
      <span
        className={`num shrink-0 text-xs ${emphasizeDay ? "font-semibold text-brand" : BADGE_CLASS[lifecycle]}`}
      >
        {compactLabel}
      </span>
    );
  }

  return <span className={`num shrink-0 text-xs ${BADGE_CLASS[lifecycle]}`}>{label}</span>;
}
