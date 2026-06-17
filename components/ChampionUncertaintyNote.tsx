import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MIN_ACCURACY_SAMPLE } from "@/lib/calibration/constants";
import { getAccuracySummary } from "@/lib/calibration/metrics";

type Props = {
  topTeamName: string | null;
  topPct: number | null;
};

export function ChampionUncertaintyNote({ topTeamName, topPct }: Props) {
  const failPct =
    topPct != null && topPct > 0 ? Math.round((100 - topPct) * 10) / 10 : null;

  return (
    <Card className="mt-4 border-border bg-surface-2/40 p-4">
      <p className="text-sm leading-relaxed text-text-muted">
        {topTeamName && topPct != null && failPct != null ? (
          <>
            Even <strong className="text-text">{topTeamName}</strong> at {topPct.toFixed(1)}% fails to
            win in <strong className="text-text">{failPct}%</strong> of simulations. A 48-team
            knockout leaves most paths open — these are probabilities, not predictions.
          </>
        ) : (
          <>
            Champion percentages are Monte Carlo frequencies, not guarantees. In a 48-team knockout,
            even the favorite loses most simulations.
          </>
        )}{" "}
        <Link href="/how-it-works" className="font-semibold text-brand hover:underline">
          How it works
        </Link>
        {" · "}
        <Link href="/accuracy" className="font-semibold text-brand hover:underline">
          Track record
        </Link>
      </p>
    </Card>
  );
}

export function ChampionAccuracyCallout() {
  const summary = getAccuracySummary();
  if (summary.count === 0) return null;

  const early = summary.sampleMaturity === "early";

  return (
    <Card className="mt-4 border-brand/30 bg-brand-tint/10 p-4">
      <p className="text-sm text-text-muted">
        {early ? (
          <>
            <strong className="text-text">{summary.count}</strong> match
            {summary.count === 1 ? "" : "es"} graded so far — need about{" "}
            {MIN_ACCURACY_SAMPLE} for meaningful calibration.{" "}
          </>
        ) : (
          <>
            <strong className="text-text">{summary.count}</strong> confirmed matches graded on{" "}
          </>
        )}
        <Link href="/accuracy" className="font-semibold text-brand hover:underline">
          Accuracy
        </Link>
        {summary.eloBaseline?.brierImprovement != null && !early && (
          <>
            {" "}
            — AI{" "}
            {summary.eloBaseline.brierImprovement >= 0 ? "beats" : "trails"} pure Elo on Brier by{" "}
            {Math.abs(summary.eloBaseline.brierImprovement).toFixed(3)}
          </>
        )}
        .
      </p>
    </Card>
  );
}
