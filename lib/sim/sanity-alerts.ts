import { getEloRating } from "@/lib/calibration/elo";
import { getTeams } from "@/lib/data/load";
import type { ChampionOddsMap, GroupStanding, SanityAlert } from "@/lib/types";

/** Post-simulation checks for surprising Elo vs odds ordering. */
export function buildSanityAlerts(
  championOdds: ChampionOddsMap,
  championOddsBase?: ChampionOddsMap | null,
  modalGroupStandings?: Record<string, GroupStanding[]> | null,
): SanityAlert[] {
  const alerts: SanityAlert[] = [];
  const teams = getTeams();

  const byElo = [...teams]
    .map((t) => ({ id: t.id, name: t.name, elo: getEloRating(t.id) ?? 0 }))
    .filter((t) => t.elo > 0)
    .sort((a, b) => b.elo - a.elo);

  for (let i = 0; i < byElo.length - 1; i++) {
    const higher = byElo[i];
    const lower = byElo[i + 1];
    const higherPct = championOdds[higher.id] ?? 0;
    const lowerPct = championOdds[lower.id] ?? 0;
    if (higherPct + 0.15 < lowerPct && lowerPct > 1) {
      alerts.push({
        type: "elo_order",
        message: `${lower.name} (${lowerPct.toFixed(1)}%) is above ${higher.name} (${higherPct.toFixed(1)}%) despite lower Elo (${lower.elo} vs ${higher.elo}).`,
        teamIds: [higher.id, lower.id],
      });
    }
  }

  if (championOddsBase) {
    for (const { id, name } of teams) {
      const cur = championOdds[id] ?? 0;
      const base = championOddsBase[id] ?? 0;
      const delta = cur - base;
      if (Math.abs(delta) >= 2 && (base > 2 || cur > 2)) {
        alerts.push({
          type: "news_shift",
          message: `${name} champion % moved ${delta > 0 ? "+" : ""}${delta.toFixed(1)} pp vs base Elo model (${base.toFixed(1)}% → ${cur.toFixed(1)}%).`,
          teamIds: [id],
        });
      }
    }
  }

  if (modalGroupStandings) {
    const eloTop10 = new Set(byElo.slice(0, 10).map((t) => t.id));
    for (const standings of Object.values(modalGroupStandings)) {
      const first = standings.find((s) => s.position === 1);
      if (!first || eloTop10.has(first.teamId)) continue;
      const team = teams.find((t) => t.id === first.teamId);
      const pct = championOdds[first.teamId] ?? 0;
      if (pct < 3) {
        alerts.push({
          type: "modal_group",
          message: `${team?.name ?? first.teamId} is the modal Group ${first.group} winner but only ${pct.toFixed(1)}% to win the tournament.`,
          teamIds: [first.teamId],
        });
      }
    }
  }

  return alerts.slice(0, 12);
}
