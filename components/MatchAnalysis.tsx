"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type { MatchPredictionView } from "@/lib/types";
import { AdminPinDialog } from "@/components/AdminPinDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProbabilityBars } from "@/components/ProbabilityBars";
import { useAdminPinGate, type AdminPinAction } from "@/lib/hooks/use-admin-pin-action";

type Props = {
  matchId: string;
  homeName: string;
  awayName: string;
  initial: MatchPredictionView | null;
};

export function MatchAnalysis({ matchId, homeName, awayName, initial }: Props) {
  const [prediction, setPrediction] = useState<MatchPredictionView | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [refreshAfterAnalyze, setRefreshAfterAnalyze] = useState(false);
  const pinGate = useAdminPinGate({
    title: "Analyze match",
    description: "Runs a single LLM analysis for this fixture. Uses API credits.",
    confirmLabel: "Analyze",
  });

  useEffect(() => {
    let active = true;
    const check = () =>
      fetch("/api/analyze/bulk")
        .then((r) => r.json())
        .then((d) => {
          if (active) setBulkRunning(Boolean(d.active) || d.job?.status === "running");
        })
        .catch(() => {});
    void check();
    const id = setInterval(check, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const analyzeMatch: AdminPinAction = async (pin) => {
    if (bulkRunning) {
      return { ok: false, status: 429, error: "Bulk analyze is running — try again when it finishes" };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, refresh: refreshAfterAnalyze, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error ?? "Analysis failed" };
      }
      setPrediction(data.prediction);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
      return { ok: false, status: 500, error: message };
    } finally {
      setLoading(false);
    }
  };

  function requestAnalyze(refresh: boolean) {
    setRefreshAfterAnalyze(refresh);
    pinGate.setError(null);
    setError(null);
    void pinGate.request(analyzeMatch);
  }

  if (!prediction) {
    return (
      <Card className="p-6 text-center">
        <Sparkles className="mx-auto mb-3 text-brand" size={28} />
        <p className="text-sm text-text-muted">No AI prediction yet for this match.</p>
        {error && <p className="mt-2 text-xs text-loss">{error}</p>}
        <Button
          variant="primary"
          className="mt-4"
          disabled={loading || bulkRunning || pinGate.loading}
          onClick={() => requestAnalyze(false)}
        >
          {loading || pinGate.loading ? "Analyzing…" : "Analyze match"}
        </Button>
        <AdminPinDialog {...pinGate.dialogProps} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">AI prediction</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="num text-[11px] text-text-muted">
              {prediction.provider} · {prediction.model}
            </span>
            {prediction.stale && (
              <span className="rounded bg-money-tint px-1.5 py-0.5 text-[10px] font-semibold text-money">
                stale
              </span>
            )}
            {prediction.newsAdjusted && prediction.newsImpact && (
              <span
                className="rounded bg-brand-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand"
                title={`Squad news Elo impact — home ${prediction.newsImpact.homeEloDelta >= 0 ? "+" : ""}${prediction.newsImpact.homeEloDelta}, away ${prediction.newsImpact.awayEloDelta >= 0 ? "+" : ""}${prediction.newsImpact.awayEloDelta}`}
              >
                news-adjusted
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          className="shrink-0 self-start"
          disabled={loading || bulkRunning || pinGate.loading}
          onClick={() => requestAnalyze(true)}
        >
          <RefreshCw size={14} className={loading || pinGate.loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <ProbabilityBars
        homeLabel={homeName}
        awayLabel={awayName}
        homeWinPct={prediction.homeWinPct}
        drawPct={prediction.drawPct}
        awayWinPct={prediction.awayWinPct}
      />

      {prediction.analysis && (
        <p className="text-sm leading-relaxed text-text-muted">{prediction.analysis}</p>
      )}

      {prediction.keyFactors.length > 0 && (
        <ul className="space-y-1 text-xs text-text-muted">
          {prediction.keyFactors.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-brand">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-loss">{error}</p>}

      <p className="num text-[10px] text-text-muted">
        Generated {new Date(prediction.generatedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
        {prediction.fromCache ? " · cached" : " · fresh"}
      </p>

      <AdminPinDialog
        {...pinGate.dialogProps}
        title={refreshAfterAnalyze ? "Re-analyze match" : "Analyze match"}
        confirmLabel={refreshAfterAnalyze ? "Re-analyze" : "Analyze"}
      />
    </div>
  );
}
