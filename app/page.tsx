import { Card } from "@/components/ui/Card";
import { BulkAnalyzePanel } from "@/components/BulkAnalyzePanel";
import { Countdown } from "@/components/Countdown";
import { ChampionOddsBars } from "@/components/ChampionOddsBars";
import { SimulationPanel } from "@/components/SimulationPanel";
import { countPredictions } from "@/lib/ai/predictions";
import { getLatestSimulation, isSimulationStale } from "@/lib/sim/simulation-cache";
import { getTeams, getFixtures, getEarliestKickoff } from "@/lib/data/load";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const teams = getTeams().sort((a, b) => a.fifaRank - b.fifaRank);
  const fixtures = getFixtures();
  const kickoff = getEarliestKickoff();
  const predictionCount = countPredictions();
  const simulation = getLatestSimulation();
  const simulationStale = isSimulationStale();

  return (
    <div className="space-y-6">
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">
        Tournament Command
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="relative overflow-hidden p-8">
          <div className="pointer-events-none absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-brand-tint blur-3xl" />
          <h1 className="max-w-[16ch] font-[family-name:var(--font-archivo)] text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            48 nations. 104 matches. One AI verdict.
          </h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-text-muted">
            <span>Kickoff <b className="text-text">Jun 11</b></span>
            <span>Final <b className="text-text">Jul 19</b></span>
            <span><b className="text-text">USA · Canada · Mexico</b></span>
          </div>
          <div className="mt-6">
            <BulkAnalyzePanel />
          </div>
          <div className="mt-8">
            <Countdown targetISO={kickoff} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-[family-name:var(--font-archivo)] text-base font-bold">Champion odds</h2>
          <p className="mt-1 text-xs text-text-muted">
            {simulation
              ? `Monte Carlo · ${simulation.iterations.toLocaleString()} iters`
              : "Run simulation after match predictions are cached"}
          </p>
          {simulationStale && simulation && (
            <p className="mt-1 text-xs font-semibold text-loss">Stale — predictions changed</p>
          )}
          <div className="mt-5">
            <ChampionOddsBars
              teams={teams}
              odds={simulation?.championOdds ?? null}
              limit={5}
            />
          </div>
          <div className="mt-4">
            <SimulationPanel
              hasSimulation={Boolean(simulation)}
              lastRunAt={simulation?.runAt ?? null}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { k: "Group matches", v: fixtures.length },
          { k: "Teams", v: teams.length },
          { k: "Knockout slots", v: "32" },
          { k: "Predictions", v: predictionCount },
          { k: "Simulation", v: simulation ? (simulationStale ? "Stale" : "Ready") : "—" },
        ].map((s) => (
          <Card key={s.k} className="p-5">
            <div className="text-xs font-semibold text-text-muted">{s.k}</div>
            <div className="num mt-2 font-[family-name:var(--font-archivo)] text-3xl font-extrabold">{s.v}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
