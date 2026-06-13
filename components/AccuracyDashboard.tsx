"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccuracySummary } from "@/lib/calibration/metrics";
import { Card } from "@/components/ui/Card";

export function AccuracyDashboard() {
  const [data, setData] = useState<AccuracySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/accuracy");
      setData(await res.json());
      setError(null);
    } catch {
      setError("Failed to load accuracy metrics");
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
    return <p className="text-sm text-text-muted">Loading accuracy data…</p>;
  }

  if (data.count === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-8 text-center text-text-muted">
          No confirmed results yet. Metrics appear after match results are confirmed (poller or admin
          entry).
        </Card>
        <Card className="p-5 text-sm text-text-muted">
          <p>
            Until then, use the{" "}
            <a href="/champion" className="font-semibold text-brand hover:underline">
              champion odds
            </a>{" "}
            page for model title probabilities, survival-by-round, and base-vs-news comparison.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.newsImpact && data.newsImpact.countWithBaseline > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-bold">News impact on accuracy</h2>
          <p className="mt-1 text-xs text-text-muted">
            Compares baseline AI predictions to news-adjusted odds shown in the app (
            {data.newsImpact.newsAdjustedCount} of {data.newsImpact.countWithBaseline} matches had squad news
            shifts).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <div className="text-xs text-text-muted">Baseline Brier</div>
              <div className="num font-bold">{data.newsImpact.avgBaselineBrier?.toFixed(3) ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">News-adjusted Brier</div>
              <div className="num font-bold">{data.newsImpact.avgNewsBrier?.toFixed(3) ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Improvement (lower is better)</div>
              <div className="num font-bold">
                {data.newsImpact.brierImprovement != null
                  ? `${data.newsImpact.brierImprovement >= 0 ? "+" : ""}${data.newsImpact.brierImprovement.toFixed(3)}`
                  : "—"}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Matches scored", value: String(data.count) },
          { label: "Avg Brier", value: data.avgBrier?.toFixed(3) ?? "—" },
          { label: "Avg log loss", value: data.avgLogLoss?.toFixed(3) ?? "—" },
          { label: "Direction accuracy", value: data.directionAccuracy != null ? `${data.directionAccuracy}%` : "—" },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <div className="text-xs font-semibold text-text-muted">{s.label}</div>
            <div className="num mt-1 text-2xl font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      {Object.keys(data.byStage).length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-bold">By stage</h2>
          <div className="mt-3 space-y-2 text-sm">
            {Object.entries(data.byStage).map(([stage, row]) => (
              <div key={stage} className="flex justify-between gap-4">
                <span className="uppercase text-text-muted">{stage}</span>
                <span className="num">
                  {row.count} matches · Brier {row.avgBrier?.toFixed(3) ?? "—"} · dir{" "}
                  {row.directionAccuracy != null ? `${row.directionAccuracy}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.calibrationBins.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-bold">Calibration bins</h2>
          <p className="mt-1 text-xs text-text-muted">Favorite confidence vs direction hit rate</p>
          <div className="mt-3 space-y-2">
            {data.calibrationBins.map((b) => (
              <div key={b.bin} className="flex items-center gap-3 text-xs">
                <span className="num w-16 shrink-0 text-text-muted">{b.bin}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                  <div className="h-full bg-brand" style={{ width: `${b.actual}%` }} />
                </div>
                <span className="num w-24 shrink-0 text-right text-text-muted">
                  pred {b.predicted}% · hit {b.actual}% ({b.count})
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.worstMisses.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-bold">Worst misses</h2>
          <div className="scrollbar-themed mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-text-muted">
                  <th className="pb-2 pr-4">Match</th>
                  <th className="pb-2 pr-4">Stage</th>
                  <th className="pb-2 pr-4">Predicted</th>
                  <th className="pb-2 pr-4">Actual</th>
                  <th className="pb-2">Brier</th>
                </tr>
              </thead>
              <tbody>
                {data.worstMisses.map((m) => (
                  <tr key={m.matchId} className="border-t border-border">
                    <td className="num py-2 pr-4">{m.matchId}</td>
                    <td className="py-2 pr-4">{m.stage}</td>
                    <td className="py-2 pr-4">{m.predicted}</td>
                    <td className="py-2 pr-4">{m.actual}</td>
                    <td className="num py-2">{m.brier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
