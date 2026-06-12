"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MatchStatusBadge } from "@/components/MatchStatusBadge";
import { getKickoffHighlight, kickoffHighlightRowClass } from "@/lib/match/kickoff-highlight";
import { getMatchLifecycle } from "@/lib/match/lifecycle";
import type { PlayedMatchResult } from "@/lib/types";

type Props = {
  matchId: string;
  homeLabel: string;
  awayLabel: string;
  kickoffIso: string;
  confirmed?: PlayedMatchResult;
  projected?: PlayedMatchResult;
};

export function GroupFixtureRow({
  matchId,
  homeLabel,
  awayLabel,
  kickoffIso,
  confirmed,
  projected,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lifecycle = getMatchLifecycle(kickoffIso, Boolean(confirmed), now);
  const highlight = getKickoffHighlight(kickoffIso, lifecycle, now);

  return (
    <Link
      href={`/match/${matchId}`}
      className={`flex items-center justify-between gap-2 px-1 py-2 text-xs hover:text-brand ${kickoffHighlightRowClass(highlight)}`}
    >
      <span>
        {homeLabel} vs {awayLabel}
      </span>
      <MatchStatusBadge
        kickoffIso={kickoffIso}
        confirmed={confirmed ? { homeGoals: confirmed.homeGoals, awayGoals: confirmed.awayGoals } : null}
        projected={
          !confirmed && projected
            ? { homeGoals: projected.homeGoals, awayGoals: projected.awayGoals }
            : null
        }
        compact
      />
    </Link>
  );
}
