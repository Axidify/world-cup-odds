"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AccuracySummary } from "@/lib/calibration/metrics";
import { formatStageLabel } from "@/lib/utils/match-label";
import { Card } from "@/components/ui/Card";

function StatCard({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-5 ${highlight ? "border-brand/40 bg-brand-tint/10" : ""}`}>
      <div className="text-xs font-semibold text-text-muted">{label}</div>
      <div className={`num mt-1 font-extrabold ${highlight ? "text-3xl text-brand" : "text-2xl"}`}>
        {value}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-text-muted">{hint}</p>
    </Card>
  );
}

export function AccuracyDashboard() {
  const [data, setData] = useState<AccuracySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/accuracy");
      setData(await res.json());
      setError(null);
    } catch {
      setError("Failed to load accuracy data");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (error) {
    return <p className="text-sm text-loss">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-text-muted">Loading track record…</p>;
  }

  if (data.count === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-8 text-center">
          <p className="font-semibold text-text">No finished matches to grade yet</p>
          <p className="mt-2 text-sm text-text-muted">
            Once results are confirmed, you&apos;ll see how often our favorite pick was right, plus
            the matches we got most wrong.
          </p>
        </Card>
        <Card className="p-5 text-sm text-text-muted">
          <p>
            Want title odds instead? See{" "}
            <Link href="/champion" className="font-semibold text-brand hover:underline">
              champion probabilities
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  const directionPct = data.directionAccuracy != null ? `${data.directionAccuracy}%` : "—";
  const newsHelped =
    data.newsImpact?.brierImprovement != null && data.newsImpact.brierImprovement > 0;

  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface-2/40 p-5">
        <h2 className="text-sm font-bold">How to read this page</h2>
        <ul className="mt-3 space-y-2 text-sm text-text-muted">
          <li>
            <strong className="text-text">Favorite pick rate</strong> — did our most likely outcome
            (home win, draw, or away win) match the result?
          </li>
          <li>
            <strong className="text-text">Biggest surprises</strong> — games where our probabilities
            were furthest from reality.
          </li>
          <li>
            <strong className="text-text">Advanced stats</strong> — optional math (Brier, calibration)
            for how tight the probability numbers were, not just who we picked.
          </li>
        </ul>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          highlight
          label="Favorite pick rate"
          value={directionPct}
          hint={`We called the most likely result correctly on ${data.count} confirmed match${data.count === 1 ? "" : "es"}.`}
        />
        <StatCard
          label="Matches graded"
          value={String(data.count)}
          hint="Each row is one finished game with stored AI odds compared to the final score."
        />
      </div>

      {data.worstMisses.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-bold">Biggest surprises</h2>
          <p className="mt-1 text-xs text-text-muted">
            Matches where our pre-game odds missed the most — not necessarily wrong winner, but
            confidently off.
          </p>
          <ul className="mt-4 space-y-3">
            {data.worstMisses.map((m) => (
              <li key={m.matchId} className="rounded-lg border border-border bg-surface-2/50 p-3">
                <Link
                  href={`/match/${m.matchId}`}
                  className="font-semibold text-brand hover:underline"
                >
                  {m.matchLabel}
                </Link>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {m.stageLabel}
                </p>
                <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-text-muted">We picked: </span>
                    <span className="font-medium text-text">{m.predicted}</span>
                  </p>
                  <p>
                    <span className="text-text-muted">What happened: </span>
                    <span className="font-medium text-text">{m.actual}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {Object.keys(data.byStage).length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-bold">By round</h2>
          <p className="mt-1 text-xs text-text-muted">Same favorite-pick rate, split by tournament stage.</p>
          <div className="mt-4 space-y-3">
            {Object.entries(data.byStage).map(([stage, row]) => (
              <div
                key={stage}
                className="flex flex-col gap-1 border-b border-border/60 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-semibold text-text">{formatStageLabel(stage)}</span>
                <span className="text-sm text-text-muted">
                  {row.count} match{row.count === 1 ? "" : "es"} ·{" "}
                  <span className="num font-semibold text-text">
                    {row.directionAccuracy != null ? `${row.directionAccuracy}%` : "—"}
                  </span>{" "}
                  favorite picks right
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.newsImpact && data.newsImpact.countWithBaseline > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-bold">Did squad news help?</h2>
          <p className="mt-1 text-sm text-text-muted">
            For {data.newsImpact.newsAdjustedCount} of {data.newsImpact.countWithBaseline} graded
            matches, injury or lineup news nudged the odds before kickoff.
            {newsHelped
              ? " On average, those nudges moved us closer to the real result."
              : data.newsImpact.brierImprovement != null && data.newsImpact.brierImprovement < 0
                ? " On average, the raw AI odds were closer than the news-adjusted ones."
                : " News nudges were a mixed bag overall."}
          </p>
        </Card>
      )}

      <details className="group rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold marker:content-none [&::-webkit-details-marker]:hidden">
          Advanced stats
          <span className="ml-2 text-xs font-normal text-text-muted">(optional)</span>
        </summary>
        <div className="space-y-5 border-t border-border px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Brier score"
              value={data.avgBrier?.toFixed(3) ?? "—"}
              hint="Average probability error. 0 is perfect; ~0.67 is random guessing. Lower is better."
            />
            <StatCard
              label="Log loss"
              value={data.avgLogLoss?.toFixed(3) ?? "—"}
              hint="Like Brier, but punishes confident wrong calls harder. Lower is better."
            />
          </div>

          {data.newsImpact && data.newsImpact.countWithBaseline > 0 && (
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="text-xs text-text-muted">Brier without news</div>
                <div className="num mt-1 font-bold">{data.newsImpact.avgBaselineBrier?.toFixed(3) ?? "—"}</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="text-xs text-text-muted">Brier with news</div>
                <div className="num mt-1 font-bold">{data.newsImpact.avgNewsBrier?.toFixed(3) ?? "—"}</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="text-xs text-text-muted">News improvement</div>
                <div className="num mt-1 font-bold">
                  {data.newsImpact.brierImprovement != null
                    ? `${data.newsImpact.brierImprovement >= 0 ? "+" : ""}${data.newsImpact.brierImprovement.toFixed(3)}`
                    : "—"}
                </div>
              </div>
            </div>
          )}

          {data.calibrationBins.length > 0 && (
            <div>
              <h3 className="text-sm font-bold">Calibration check</h3>
              <p className="mt-1 text-xs text-text-muted">
                When we said a team had X% chance to win, how often did that outcome actually happen?
                Bars closer to the predicted % mean better calibration.
              </p>
              <div className="mt-3 space-y-3">
                {data.calibrationBins.map((b) => (
                  <div key={b.bin}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-semibold text-text">Favorite around {b.bin}</span>
                      <span className="num text-text-muted">
                        happened {b.actual}% of the time ({b.count} match{b.count === 1 ? "" : "es"})
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${b.actual}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
