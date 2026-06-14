"use client";

import { Card } from "@/components/ui/Card";
import {
  DashboardLiveMatchRow,
  type DashboardLiveMatch,
} from "@/components/DashboardLiveMatchRow";

export function DashboardLiveSection({ matches }: { matches: DashboardLiveMatch[] }) {
  if (matches.length === 0) return null;

  return (
    <Card className="border-loss/40 bg-loss/5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-archivo)] text-base font-bold text-loss">
          Live now
        </h2>
        <p className="text-xs text-text-muted">
          {matches.length} match{matches.length === 1 ? "" : "es"} in play
        </p>
      </div>
      <ul className="mt-4 space-y-2">
        {matches.map((match) => (
          <li key={match.matchId}>
            <DashboardLiveMatchRow match={match} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
