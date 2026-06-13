import { AccuracyDashboard } from "@/components/AccuracyDashboard";
import { SanityAlertsPanel } from "@/components/SanityAlertsPanel";
import { SurvivalOddsTable } from "@/components/SurvivalOddsTable";
import { getTeams } from "@/lib/data/load";
import { getLatestSimulation } from "@/lib/sim/simulation-cache";

export const dynamic = "force-dynamic";

export default function AccuracyPage() {
  const teams = getTeams();
  const simulation = getLatestSimulation();
  const extras = simulation?.extras;

  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Accuracy</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">Prediction accuracy</h1>
      <p className="mt-2 text-sm text-text-muted">
        Brier score, log loss, and direction accuracy from confirmed match results.
      </p>

      <SanityAlertsPanel alerts={extras?.sanityAlerts ?? []} />

      <div className="mt-8">
        <AccuracyDashboard />
      </div>

      <SurvivalOddsTable
        teams={teams}
        survival={extras?.survivalOdds ?? null}
        championOdds={simulation?.championOdds ?? null}
      />
    </div>
  );
}
