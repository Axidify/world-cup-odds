import { ChampionOddsUpdate } from "@/components/ChampionOddsUpdate";
import { Flag } from "@/components/Flag";
import { SanityAlertsPanel } from "@/components/SanityAlertsPanel";
import { SimulationPanel } from "@/components/SimulationPanel";
import { SurvivalOddsTable } from "@/components/SurvivalOddsTable";
import { Card } from "@/components/ui/Card";
import { getChampionUpdateContext } from "@/lib/sim/champion-update";
import { getLatestSimulation } from "@/lib/sim/simulation-cache";
import { getTeams } from "@/lib/data/load";

export const dynamic = "force-dynamic";

function impliedOdds(pct: number): string {
  if (pct <= 0) return "—";
  return (100 / pct).toFixed(2);
}

export default function ChampionPage() {
  const teams = [...getTeams()].sort((a, b) => a.fifaRank - b.fifaRank);
  const update = getChampionUpdateContext();
  const simulation = getLatestSimulation();
  const extras = simulation?.extras;
  const odds = update.afterOdds ?? update.beforeOdds;
  const baseOdds = extras?.championOddsBase;
  const showComparison = update.status === "updated" && update.beforeOdds != null;
  const showBase = Boolean(baseOdds && odds);

  const ranked = [...teams]
    .map((t) => {
      const pct = odds?.[t.id] ?? 0;
      const prior = update.beforeOdds?.[t.id] ?? 0;
      const delta = showComparison ? pct - prior : 0;
      const base = baseOdds?.[t.id] ?? 0;
      return { team: t, pct, prior, delta, base };
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
          : " — run simulation after match predictions are cached"}
        {showBase ? " · Current includes news; Base is AI without news" : ""}
      </p>

      <ChampionOddsUpdate context={update} />
      <SanityAlertsPanel alerts={extras?.sanityAlerts ?? []} />

      <div className="mt-4">
        <SimulationPanel
          hasSimulation={Boolean(update.after ?? update.before)}
          lastRunAt={update.after?.runAt ?? update.before?.runAt ?? null}
        />
      </div>

      <Card className="mt-8 overflow-hidden">
        <div className="scrollbar-themed overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[10px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Team</th>
                <th className="px-4 py-3 text-right font-semibold">FIFA</th>
                {showBase && (
                  <th className="px-4 py-3 text-right font-semibold">Base %</th>
                )}
                {showComparison && (
                  <th className="px-4 py-3 text-right font-semibold">Prior %</th>
                )}
                <th className="px-4 py-3 text-right font-semibold">
                  {showBase ? "Current %" : showComparison ? "Current %" : "Champion %"}
                </th>
                {showComparison && (
                  <th className="px-4 py-3 text-right font-semibold">Change</th>
                )}
                <th className="px-4 py-3 text-right font-semibold">Decimal</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ team, pct, prior, delta, base }, i) => (
                <tr key={team.id} className="border-t border-border">
                  <td className="num px-4 py-3 text-text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3 font-semibold">
                      <Flag code={team.flagCode} alt={team.name} size="sm" />
                      {team.name}
                    </span>
                  </td>
                  <td className="num px-4 py-3 text-right text-text-muted">#{team.fifaRank}</td>
                  {showBase && (
                    <td className="num px-4 py-3 text-right text-text-muted">
                      {baseOdds ? `${base.toFixed(2)}%` : "—"}
                    </td>
                  )}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <SurvivalOddsTable
        teams={teams}
        survival={extras?.survivalOdds ?? null}
        championOdds={odds}
      />

      {update.after && (
        <p className="mt-4 text-xs text-text-muted">
          {extras?.representativePathNote ??
            "The projected bracket shows the most common path among runs where the top team here wins."}
        </p>
      )}
    </div>
  );
}
