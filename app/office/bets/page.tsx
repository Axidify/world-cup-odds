"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BetSlip } from "@/components/BetSlip";
import { Card } from "@/components/ui/Card";

const UPCOMING_MATCHES = [
  { id: "grp-a-1", label: "Mexico vs South Africa (Group A)" },
  { id: "grp-a-2", label: "Korea Republic vs TBD" },
];

export default function PlaceBetPage() {
  const [betType, setBetType] = useState<"match" | "champion">("match");
  const [matchId, setMatchId] = useState("grp-a-1");
  const [teamId, setTeamId] = useState("mex");
  const [teamName, setTeamName] = useState("Mexico");

  const championTeams = useMemo(
    () => [
      { id: "mex", name: "Mexico" },
      { id: "usa", name: "United States" },
      { id: "can", name: "Canada" },
      { id: "bra", name: "Brazil" },
      { id: "arg", name: "Argentina" },
      { id: "fra", name: "France" },
      { id: "eng", name: "England" },
      { id: "esp", name: "Spain" },
    ],
    [],
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/office" className="text-xs font-semibold text-brand hover:underline">
        ← Back to office
      </Link>
      <div>
        <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Office Pool</p>
        <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">Place a bet</h1>
      </div>

      <Card className="p-4">
        <div className="flex gap-2">
          {(["match", "champion"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setBetType(type)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                betType === type ? "bg-brand text-[oklch(0.16_0.02_250)]" : "bg-surface-2 text-text-muted"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {betType === "match" ? (
          <label className="mt-4 block text-xs text-text-muted">
            Match ID
            <input
              list="match-ids"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className="mt-1 block w-full rounded border border-border bg-surface px-2 py-2 text-sm"
            />
            <datalist id="match-ids">
              {UPCOMING_MATCHES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </datalist>
          </label>
        ) : (
          <label className="mt-4 block text-xs text-text-muted">
            Team
            <select
              value={teamId}
              onChange={(e) => {
                const t = championTeams.find((x) => x.id === e.target.value);
                setTeamId(e.target.value);
                if (t) setTeamName(t.name);
              }}
              className="mt-1 block w-full rounded border border-border bg-surface px-2 py-2 text-sm"
            >
              {championTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </Card>

      {betType === "match" ? (
        <BetSlip mode="match" matchId={matchId} />
      ) : (
        <BetSlip mode="champion" teamId={teamId} teamName={teamName} />
      )}
    </div>
  );
}
