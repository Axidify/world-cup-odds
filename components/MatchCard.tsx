"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flag } from "@/components/Flag";
import { Card } from "@/components/ui/Card";
import { getKickoffHighlight, kickoffHighlightCardClass } from "@/lib/match/kickoff-highlight";
import { getMatchLifecycle } from "@/lib/match/lifecycle";
import { ClientLocalDate } from "@/components/ClientDateText";
import type { Match, Team } from "@/lib/types";

export function MatchCard({ match, teams }: { match: Match; teams: Team[] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const map = new Map(teams.map((t) => [t.id, t]));
  const home = match.homeTeamId === "TBD" ? null : map.get(match.homeTeamId);
  const away = match.awayTeamId === "TBD" ? null : map.get(match.awayTeamId);

  const lifecycle = getMatchLifecycle(match.date, false, now);
  const highlight = getKickoffHighlight(match.date, lifecycle, now);

  return (
    <Link href={`/match/${match.id}`}>
      <Card
        className={`flex items-center justify-between gap-3 p-4 transition-colors hover:border-brand ${kickoffHighlightCardClass(highlight)}`}
        suppressHydrationWarning
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {home ? <Flag code={home.flagCode} alt={home.name} size="sm" /> : <span className="text-text-muted">TBD</span>}
          <span className="truncate text-sm font-semibold">{home?.name ?? "TBD"}</span>
          <span className="text-text-muted">vs</span>
          <span className="truncate text-sm font-semibold">{away?.name ?? "TBD"}</span>
          {away ? <Flag code={away.flagCode} alt={away.name} size="sm" /> : null}
        </div>
        <div className="text-right text-xs text-text-muted">
          <div className="uppercase">{match.stage}</div>
          <div className="num">
            <ClientLocalDate iso={match.date} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
