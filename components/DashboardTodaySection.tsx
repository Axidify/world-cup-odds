import { getAllMatches, getTeam } from "@/lib/data/load";
import { resolveFixtureWinProbs } from "@/lib/match/group-fixture-probs";
import {
  DashboardTodaySectionClient,
  type DashboardUpcomingItem,
} from "@/components/DashboardTodaySectionClient";

/** Wide enough to include today/tomorrow in any viewer timezone before client filter. */
const COMING_UP_HORIZON_MS = 48 * 60 * 60 * 1000;

export function DashboardTodaySection() {
  const now = Date.now();
  const horizonEnd = now + COMING_UP_HORIZON_MS;

  const candidates: DashboardUpcomingItem[] = [];

  for (const m of getAllMatches()) {
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;

    const kickoffMs = new Date(m.date).getTime();
    if (kickoffMs <= now || kickoffMs > horizonEnd) continue;

    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);
    if (!home || !away) continue;

    candidates.push({
      id: m.id,
      date: m.date,
      group: m.group,
      home: { name: home.name, flagCode: home.flagCode },
      away: { name: away.name, flagCode: away.flagCode },
      probs: resolveFixtureWinProbs(m.homeTeamId, m.awayTeamId, m.stage, m.date),
    });
  }

  return <DashboardTodaySectionClient candidates={candidates} />;
}
