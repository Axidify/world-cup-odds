import Link from "next/link";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default function HowItWorksPage() {
  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Methodology</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">How it works</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
        World Cup Odds is a forecasting experiment, not betting advice. The real model is the{" "}
        <strong className="text-text">match predictor</strong>; the tournament simulator rolls those
        probabilities forward thousands of times.
      </p>

      <div className="mt-8 space-y-6">
        <Card className="p-5">
          <h2 className="text-sm font-bold">1. Match probabilities</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            For each fixture, an LLM (configurable provider) estimates home win, draw, and away win
            percentages. Inputs include World Football Elo ratings, FIFA rank, confederation, and
            recent squad news snippets. Predictions are cached in SQLite — the LLM is{" "}
            <strong className="text-text">not</strong> called during Monte Carlo iterations.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold">2. News adjustments</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            The LLM extracts structured events (injuries, suspensions, returns) from search results.
            Deterministic code converts those into capped Elo-equivalent deltas (default ±35 points),
            scaled by days until kickoff. This nudges displayed odds without re-running analysis.
            Disable with <code className="text-xs">NEWS_IMPACT_ENABLED=false</code>.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold">3. Monte Carlo tournament simulation</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            With default 5,000 iterations and a fixed RNG seed, each run: locks in confirmed scores;
            samples unplayed group matches from cached probabilities; ranks groups and third-place
            qualifiers; resolves the knockout bracket. Champion odds are the fraction of runs each team
            wins the final. Survival odds track how often teams reach each round.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold">4. Elo updates</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            After each confirmed result, team Elo ratings update (K=32 in groups, K=40 in
            knockouts). Elo seeds missing predictions and powers fallback odds for rare bracket paths.
            Post-tournament Elo is <strong className="text-text">not</strong> the same as pre-match
            Elo used for grading.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold">5. Validation</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            The{" "}
            <Link href="/accuracy" className="font-semibold text-brand hover:underline">
              Accuracy
            </Link>{" "}
            page grades every confirmed match: Brier score, log loss, favorite-pick rate, and
            calibration bins. We compare AI odds to pure Elo-at-kickoff and to news-adjusted vs
            AI-base lines. Sample size is still small early in the tournament — treat early metrics
            as directional, not definitive.
          </p>
        </Card>

        <Card className="border-brand/30 bg-brand-tint/10 p-5">
          <h2 className="text-sm font-bold">Known limitations</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-text-muted">
            <li>No explicit host-nation bonus for USA, Mexico, or Canada (2026 hosts).</li>
            <li>Draw probabilities may be miscalibrated in group stage — under active monitoring.</li>
            <li>Knockout ties are sampled from win probabilities, not separate penalty models.</li>
            <li>Champion odds are sensitive to early results — that is expected in a 48-team knockout.</li>
            <li>
              A 24% favorite still loses in <strong className="text-text">76%</strong> of simulations.
            </li>
          </ul>
        </Card>
      </div>

      <p className="mt-8 text-xs text-text-muted">
        See also{" "}
        <Link href="/accuracy" className="font-semibold text-brand hover:underline">
          live track record
        </Link>{" "}
        and{" "}
        <Link href="/champion" className="font-semibold text-brand hover:underline">
          champion odds
        </Link>
        .
      </p>
    </div>
  );
}
