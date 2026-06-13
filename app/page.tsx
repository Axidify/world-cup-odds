import { Card } from "@/components/ui/Card";
import { BulkAnalyzePanel } from "@/components/BulkAnalyzePanel";
import { Countdown } from "@/components/Countdown";
import { ChampionOddsBars } from "@/components/ChampionOddsBars";
import { DashboardTodaySection } from "@/components/DashboardTodaySection";
import { SimulationPanel } from "@/components/SimulationPanel";
import { SimulationStaleAlert } from "@/components/SimulationStaleAlert";
import { ResultsSyncBanner } from "@/components/ResultsSyncBanner";
import { TournamentStatusBanner } from "@/components/TournamentStatusBanner";
import { countPredictions } from "@/lib/ai/predictions";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { getLatestSimulation, getSimulationStaleState } from "@/lib/sim/simulation-cache";
import { getNextUpcomingMatches } from "@/lib/match/next-upcoming";
import { resolveFixtureWinProbs } from "@/lib/match/group-fixture-probs";
import { getTeams, getFixtures, getEarliestKickoff, getAllMatches, getTeam } from "@/lib/data/load";
import { formatUtcDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const teams = getTeams().sort((a, b) => a.fifaRank - b.fifaRank);
  const fixtures = getFixtures();
  const allMatches = getAllMatches();
  const kickoff = getEarliestKickoff();
  const finalDate = [...allMatches].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
  const provider = resolveActiveProvider();
  const predictionCount = countPredictions({ provider, nonStale: true });
  const simulation = getLatestSimulation();
  const staleState = getSimulationStaleState();
  const nextMatches = getNextUpcomingMatches().flatMap((m) => {
    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);
    if (!home || !away) return [];
    return [
      {
        matchId: m.id,
        kickoffIso: m.date,
        homeName: home.name,
        awayName: away.name,
        homeFlagCode: home.flagCode,
        awayFlagCode: away.flagCode,
        group: m.group,
        stage: m.stage,
        prediction: resolveFixtureWinProbs(m.homeTeamId, m.awayTeamId, m.stage, m.date),
      },
    ];
  });

  return (
    <div className="space-y-6">
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">
        Tournament Command
      </p>

      <ResultsSyncBanner />
      <TournamentStatusBanner />

      <DashboardTodaySection />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="relative overflow-hidden p-8">
          <div className="pointer-events-none absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-brand-tint blur-3xl" />
          <h1 className="max-w-[16ch] font-[family-name:var(--font-archivo)] text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            48 nations. 104 matches. One AI verdict.
          </h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-text-muted">
            <span>Kickoff <b className="text-text">{formatUtcDate(kickoff)}</b></span>
            {finalDate && (
              <span>Final <b className="text-text">{formatUtcDate(finalDate)}</b></span>
            )}
            <span><b className="text-text">USA · Canada · Mexico</b></span>
          </div>
          <div className="mt-8">
            <Countdown matches={nextMatches} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-[family-name:var(--font-archivo)] text-base font-bold">Champion odds</h2>
          <p className="mt-1 text-xs text-text-muted">
            {simulation
              ? `Monte Carlo · ${simulation.iterations.toLocaleString()} iters`
              : "Run simulation after match predictions are cached"}
          </p>
          <SimulationStaleAlert hasSimulation={Boolean(simulation)} className="mt-1" />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { k: "Group matches", v: fixtures.length },
          { k: "All matches", v: allMatches.length },
          { k: "Teams", v: teams.length },
          { k: "Knockout slots", v: "32" },
          { k: "Predictions", v: predictionCount },
          { k: "Simulation", v: simulation ? (staleState.stale ? "Stale" : "Ready") : "—" },
        ].map((s) => (
          <Card key={s.k} className="p-5">
            <div className="text-xs font-semibold text-text-muted">{s.k}</div>
            <div className="num mt-2 font-[family-name:var(--font-archivo)] text-3xl font-extrabold">{s.v}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="font-[family-name:var(--font-archivo)] text-base font-bold">Admin tools</h2>
        <p className="mt-1 text-xs text-text-muted">Bulk LLM analysis for missing match predictions</p>
        <div className="mt-4">
          <BulkAnalyzePanel />
        </div>
      </Card>
    </div>
  );
}
