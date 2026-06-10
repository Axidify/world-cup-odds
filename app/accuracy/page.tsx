import { AccuracyDashboard } from "@/components/AccuracyDashboard";

export const dynamic = "force-dynamic";

export default function AccuracyPage() {
  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Accuracy</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">Prediction accuracy</h1>
      <p className="mt-2 text-sm text-text-muted">
        Brier score, log loss, and direction accuracy from confirmed match results.
      </p>
      <div className="mt-8">
        <AccuracyDashboard />
      </div>
    </div>
  );
}
