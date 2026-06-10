import { ChampionBetButton } from "@/components/ChampionBetButton";
import { Flag } from "@/components/Flag";
import { SimulationPanel } from "@/components/SimulationPanel";
import { Card } from "@/components/ui/Card";
import { getLatestSimulation, isSimulationStale } from "@/lib/sim/simulation-cache";
import { getTeams } from "@/lib/data/load";

export const dynamic = "force-dynamic";

function impliedOdds(pct: number): string {
  if (pct <= 0) return "—";
  return (100 / pct).toFixed(2);
}

export default function ChampionPage() {
  const teams = [...getTeams()].sort((a, b) => a.fifaRank - b.fifaRank);
  const simulation = getLatestSimulation();
  const stale = isSimulationStale();
  const odds = simulation?.championOdds ?? null;

  const ranked = [...teams]
    .map((t) => ({ team: t, pct: odds?.[t.id] ?? 0 }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Champion Odds</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">All 48 teams</h1>
      <p className="mt-2 text-sm text-text-muted">
        Monte Carlo champion probabilities
        {simulation
          ? ` · ${simulation.iterations.toLocaleString()} iterations · ${simulation.model}`
          : " — run simulation after AI predictions are cached"}
      </p>

      {stale && simulation && (
        <p className="mt-2 text-xs font-semibold text-loss">
          Predictions updated since last simulation — re-run for fresh champion odds.
        </p>
      )}
      <div className="mt-4">
        <SimulationPanel hasSimulation={Boolean(simulation)} lastRunAt={simulation?.runAt ?? null} />
      </div>

      <Card className="mt-8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Team</th>
              <th className="px-4 py-3 text-right font-semibold">FIFA</th>
              <th className="px-4 py-3 text-right font-semibold">Champion %</th>
              <th className="px-4 py-3 text-right font-semibold">Decimal</th>
              <th className="px-4 py-3 text-right font-semibold">Bet</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ team, pct }, i) => (
              <tr key={team.id} className="border-t border-border">
                <td className="num px-4 py-3 text-text-muted">{i + 1}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3 font-semibold">
                    <Flag code={team.flagCode} alt={team.name} size="sm" />
                    {team.name}
                  </span>
                </td>
                <td className="num px-4 py-3 text-right text-text-muted">#{team.fifaRank}</td>
                <td className="num px-4 py-3 text-right font-semibold">
                  {odds ? `${pct.toFixed(2)}%` : "—"}
                </td>
                <td className="num px-4 py-3 text-right text-money">{odds ? impliedOdds(pct) : "—"}</td>
                <td className="px-4 py-3 text-right">
                  {odds ? <ChampionBetButton teamId={team.id} teamName={team.name} /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {simulation && (
        <p className="mt-4 text-xs text-text-muted">
          Seeded Monte Carlo ({simulation.iterations} iters). Modal predicted champion may differ — see
          bracket page.
        </p>
      )}
    </div>
  );
}
