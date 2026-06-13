"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MatchStatusBadge } from "@/components/MatchStatusBadge";
import { getKickoffHighlight, kickoffHighlightRowClass } from "@/lib/match/kickoff-highlight";
import { getMatchLifecycle } from "@/lib/match/lifecycle";
import type { FixtureWinProbs } from "@/lib/match/group-fixture-probs";
import type { PlayedMatchResult } from "@/lib/types";

type Props = {
  matchId: string;
  homeLabel: string;
  awayLabel: string;
  kickoffIso: string;
  confirmed?: PlayedMatchResult;
  projectedProbs?: FixtureWinProbs;
};

export function GroupFixtureRow({
  matchId,
  homeLabel,
  awayLabel,
  kickoffIso,
  confirmed,
  projectedProbs,
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
      className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1 py-2 text-xs hover:text-brand sm:flex-nowrap ${kickoffHighlightRowClass(highlight)}`}
    >
      <span className="min-w-0 flex-1 font-medium leading-snug">
        <span className="sm:hidden">
          {homeLabel} v {awayLabel}
        </span>
        <span className="hidden sm:inline">
          {homeLabel} vs {awayLabel}
        </span>
      </span>
      <MatchStatusBadge
        kickoffIso={kickoffIso}
        confirmed={confirmed ? { homeGoals: confirmed.homeGoals, awayGoals: confirmed.awayGoals } : null}
        projectedProbs={!confirmed ? projectedProbs : null}
        compact
      />
    </Link>
  );
}
