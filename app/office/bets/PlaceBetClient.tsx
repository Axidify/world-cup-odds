"use client";

import { useState } from "react";
import Link from "next/link";
import { BetSlip } from "@/components/BetSlip";
import { Card } from "@/components/ui/Card";
import type { Team } from "@/lib/types";

type Props = {
  teams: Team[];
};

export function PlaceBetClient({ teams }: Props) {
  const sorted = [...teams].sort((a, b) => a.fifaRank - b.fifaRank);
  const [teamId, setTeamId] = useState(sorted[0]?.id ?? "");
  const teamName = sorted.find((t) => t.id === teamId)?.name ?? "";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/office" className="text-xs font-semibold text-brand hover:underline">
        ← Back to office
      </Link>
      <div>
        <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Office Pool</p>
        <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">
          Pick your champion
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          One market: who wins the 2026 World Cup. Fixed stake for everyone — odds come from the
          AI tournament simulation.
        </p>
      </div>

      <Card className="p-4">
        <label className="block text-xs text-text-muted">
          Team
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-surface px-2 py-2 text-sm"
          >
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (FIFA #{t.fifaRank})
              </option>
            ))}
          </select>
        </label>
      </Card>

      {teamId && <BetSlip teamId={teamId} teamName={teamName} />}
    </div>
  );
}
