import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Flag } from "@/components/Flag";
import { getAllMatches, getTeam } from "@/lib/data/load";
import { formatUtcDateTime } from "@/lib/utils/dates";

function isTodayOrTomorrow(iso: string, now = Date.now()): boolean {
  const kickoff = new Date(iso).getTime();
  const dayMs = 86_400_000;
  const startToday = new Date(now).setHours(0, 0, 0, 0);
  const endTomorrow = startToday + dayMs * 2;
  return kickoff >= startToday - dayMs && kickoff < endTomorrow;
}

export function DashboardTodaySection() {
  const upcoming = getAllMatches()
    .filter((m) => m.homeTeamId !== "TBD" && m.awayTeamId !== "TBD")
    .filter((m) => isTodayOrTomorrow(m.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  if (upcoming.length === 0) return null;

  return (
    <Card className="p-5">
      <h2 className="font-[family-name:var(--font-archivo)] text-base font-bold">Coming up</h2>
      <p className="mt-1 text-xs text-text-muted">Today and tomorrow (UTC kickoffs)</p>
      <ul className="mt-4 space-y-2">
        {upcoming.map((m) => {
          const home = getTeam(m.homeTeamId);
          const away = getTeam(m.awayTeamId);
          if (!home || !away) return null;
          return (
            <li key={m.id}>
              <Link
                href={`/match/${m.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Flag code={home.flagCode} alt={home.name} size="sm" />
                  {home.name}
                  <span className="text-text-muted">vs</span>
                  <Flag code={away.flagCode} alt={away.name} size="sm" />
                  {away.name}
                </span>
                <span className="num text-xs text-text-muted">
                  {formatUtcDateTime(m.date)} UTC
                  {m.group ? ` · Gp ${m.group}` : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
