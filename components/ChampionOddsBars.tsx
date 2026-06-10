import Link from "next/link";
import { Flag } from "@/components/Flag";
import type { ChampionOddsMap, Team } from "@/lib/types";

type Props = {
  teams: Team[];
  odds: ChampionOddsMap | null;
  limit?: number;
  showViewAll?: boolean;
};

export function ChampionOddsBars({ teams, odds, limit = 5, showViewAll = true }: Props) {
  const ranked = [...teams]
    .map((t) => ({ team: t, pct: odds?.[t.id] ?? 0 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit);
  const maxPct = ranked[0]?.pct ?? 1;

  return (
    <div className="space-y-3">
      {ranked.map(({ team, pct }) => (
        <div key={team.id} className="grid grid-cols-[28px_1fr_52px] items-center gap-3">
          <Flag code={team.flagCode} alt={team.name} size="md" />
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: odds ? `${(pct / maxPct) * 100}%` : "0%" }}
            />
          </div>
          <span className="num text-right text-sm font-semibold">
            {odds ? `${pct.toFixed(1)}%` : "—"}
          </span>
        </div>
      ))}
      {showViewAll && (
        <Link href="/champion" className="inline-block text-sm font-semibold text-brand">
          View all 48 →
        </Link>
      )}
    </div>
  );
}
