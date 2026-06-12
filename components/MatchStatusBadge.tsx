"use client";

import { useEffect, useState } from "react";
import {
  formatLifecycleLabel,
  getMatchLifecycle,
  type MatchLifecycle,
} from "@/lib/match/lifecycle";

type ScoreLine = { homeGoals: number; awayGoals: number };

type Props = {
  kickoffIso: string;
  confirmed?: ScoreLine | null;
  /** Modal simulation score for unplayed group fixtures (projected view). */
  projected?: ScoreLine | null;
  compact?: boolean;
};

const BADGE_CLASS: Record<MatchLifecycle, string> = {
  upcoming: "text-text-muted",
  live: "text-loss font-semibold",
  awaiting_result: "text-money font-semibold",
  confirmed: "text-win font-semibold",
};

export function MatchStatusBadge({ kickoffIso, confirmed, projected, compact = false }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lifecycle = getMatchLifecycle(kickoffIso, Boolean(confirmed), now);

  if (lifecycle === "confirmed" && confirmed) {
    return (
      <span className={`num shrink-0 ${BADGE_CLASS.confirmed}`}>
        {confirmed.homeGoals}–{confirmed.awayGoals}{" "}
        <span className="text-[10px] font-normal uppercase tracking-wide">FT</span>
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

  const label = formatLifecycleLabel(lifecycle, kickoffIso, now);

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

  return (
    <span className={`num shrink-0 text-xs ${BADGE_CLASS[lifecycle]}`}>
      {compact ? (lifecycle === "awaiting_result" ? "Syncing…" : label) : label}
    </span>
  );
}
