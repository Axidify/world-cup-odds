"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Flag } from "@/components/Flag";
import { DashboardMatchPrediction } from "@/components/DashboardMatchPrediction";
import { DashboardComingUpKickoff } from "@/components/DashboardComingUpKickoff";
import { LiveMatchBadge } from "@/components/LiveMatchBadge";
import { isDashboardComingUpMatch } from "@/lib/match/dashboard-upcoming";
import type { FixtureWinProbs } from "@/lib/match/group-fixture-probs";

export type DashboardUpcomingItem = {
  id: string;
  date: string;
  group?: string;
  home: { name: string; flagCode: string };
  away: { name: string; flagCode: string };
  probs: FixtureWinProbs | null;
};

type Props = {
  candidates: DashboardUpcomingItem[];
};

export function DashboardTodaySectionClient({ candidates }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const upcoming = candidates
    .filter((m) => isDashboardComingUpMatch(m.date, now))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  if (upcoming.length === 0) return null;

  return (
    <Card className="p-5">
      <h2 className="font-[family-name:var(--font-archivo)] text-base font-bold">Coming up</h2>
      <p className="mt-1 text-xs text-text-muted">Today and tomorrow</p>
      <ul className="mt-4 space-y-2">
        {upcoming.map((m) => (
          <li key={m.id}>
            <Link
              href={`/match/${m.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2"
            >
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <Flag code={m.home.flagCode} alt={m.home.name} size="sm" />
                {m.home.name}
                <span className="text-text-muted">vs</span>
                <Flag code={m.away.flagCode} alt={m.away.name} size="sm" />
                {m.away.name}
              </span>
              <span className="flex flex-wrap items-center justify-end gap-3">
                <DashboardMatchPrediction
                  probs={m.probs}
                  homeLabel={m.home.name}
                  awayLabel={m.away.name}
                />
                <LiveMatchBadge matchId={m.id} kickoffIso={m.date} />
                <DashboardComingUpKickoff kickoffIso={m.date} group={m.group} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
