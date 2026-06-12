import { ChampionBetButton } from "@/components/ChampionBetButton";
import { ChampionOddsUpdate } from "@/components/ChampionOddsUpdate";
import { Flag } from "@/components/Flag";
import { SimulationPanel } from "@/components/SimulationPanel";
import { Card } from "@/components/ui/Card";
import { getChampionUpdateContext } from "@/lib/sim/champion-update";
import { getTeams } from "@/lib/data/load";

export const dynamic = "force-dynamic";

function impliedOdds(pct: number): string {
  if (pct <= 0) return "—";
  return (100 / pct).toFixed(2);
}

export default function ChampionPage() {
  const teams = [...getTeams()].sort((a, b) => a.fifaRank - b.fifaRank);
  const update = getChampionUpdateContext();
  const odds = update.afterOdds ?? update.beforeOdds;
  const showComparison = update.status === "updated" && update.beforeOdds != null;

  const ranked = [...teams]
    .map((t) => {
      const pct = odds?.[t.id] ?? 0;
      const prior = update.beforeOdds?.[t.id] ?? 0;
      const delta = showComparison ? pct - prior : 0;
      return { team: t, pct, prior, delta };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Champion Odds</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">All 48 teams</h1>
      <p className="mt-2 text-sm text-text-muted">
        Monte Carlo champion probabilities
        {update.after
          ? ` · ${update.after.iterations.toLocaleString()} iterations · ${update.after.model}`
          : " — run simulation after AI predictions are cached"}
      </p>

      <ChampionOddsUpdate context={update} />

      <div className="mt-4">
        <SimulationPanel
          hasSimulation={Boolean(update.after ?? update.before)}
          lastRunAt={update.after?.runAt ?? update.before?.runAt ?? null}
        />
      </div>

      <Card className="mt-8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Team</th>
              <th className="px-4 py-3 text-right font-semibold">FIFA</th>
              {showComparison && (
                <th className="px-4 py-3 text-right font-semibold">Prior %</th>
              )}
              <th className="px-4 py-3 text-right font-semibold">
                {showComparison ? "Current %" : "Champion %"}
              </th>
              {showComparison && (
                <th className="px-4 py-3 text-right font-semibold">Change</th>
              )}
              <th className="px-4 py-3 text-right font-semibold">Decimal</th>
              <th className="px-4 py-3 text-right font-semibold">Bet</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ team, pct, prior, delta }, i) => (
              <tr key={team.id} className="border-t border-border">
                <td className="num px-4 py-3 text-text-muted">{i + 1}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3 font-semibold">
                    <Flag code={team.flagCode} alt={team.name} size="sm" />
                    {team.name}
                  </span>
                </td>
                <td className="num px-4 py-3 text-right text-text-muted">#{team.fifaRank}</td>
                {showComparison && (
                  <td className="num px-4 py-3 text-right text-text-muted">
                    {odds ? `${prior.toFixed(2)}%` : "—"}
                  </td>
                )}
                <td className="num px-4 py-3 text-right font-semibold">
                  {odds ? `${pct.toFixed(2)}%` : "—"}
                </td>
                {showComparison && (
                  <td
                    className={`num px-4 py-3 text-right font-semibold ${
                      delta > 0 ? "text-win" : delta < 0 ? "text-loss" : "text-text-muted"
                    }`}
                  >
                    {odds ? `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%` : "—"}
                  </td>
                )}
                <td className="num px-4 py-3 text-right text-money">{odds ? impliedOdds(pct) : "—"}</td>
                <td className="px-4 py-3 text-right">
                  {odds ? <ChampionBetButton teamId={team.id} teamName={team.name} /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {update.after && (
        <p className="mt-4 text-xs text-text-muted">
          Seeded Monte Carlo ({update.after.iterations.toLocaleString()} iters). The most likely knockout
          path (bracket page) can differ from these headline percentages.
        </p>
      )}
    </div>
  );
}
