import { AccuracyDashboard } from "@/components/AccuracyDashboard";
import { SanityAlertsPanel } from "@/components/SanityAlertsPanel";
import { getLatestSimulation } from "@/lib/sim/simulation-cache";

export const dynamic = "force-dynamic";

export default function AccuracyPage() {
  const simulation = getLatestSimulation();
  const extras = simulation?.extras;

  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Track record</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">
        How good were our picks?
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
        After each match is confirmed, we compare the AI&apos;s pre-match odds to what actually
        happened. This page is our report card — no betting advice, just honest scoring.
      </p>

      <SanityAlertsPanel alerts={extras?.sanityAlerts ?? []} />

      <div className="mt-8">
        <AccuracyDashboard />
      </div>
    </div>
  );
}
