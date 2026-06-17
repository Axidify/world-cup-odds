"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { AccuracySummary } from "@/lib/calibration/metrics";
import { MIN_ACCURACY_SAMPLE } from "@/lib/calibration/constants";
import { formatStageLabel } from "@/lib/utils/match-label";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const MATCHES_PAGE_SIZE = 10;

type GradedMatch = AccuracySummary["worstMisses"][number];

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

function GradedMatchRow({ match }: { match: GradedMatch }) {
  const success = match.directionCorrect;

  return (
    <li
      className={`rounded-lg border p-3 ${
        success ? "border-win/40 bg-win/5" : "border-loss/40 bg-loss/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/match/${match.matchId}`}
            className="font-semibold text-brand hover:underline"
          >
            {match.matchLabel}
          </Link>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {match.stageLabel}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            success ? "bg-win/15 text-win" : "bg-loss/15 text-loss"
          }`}
        >
          {success ? <Check size={12} aria-hidden /> : <X size={12} aria-hidden />}
          {success ? "Correct pick" : "Missed pick"}
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
        <p>
          <span className="text-text-muted">We picked: </span>
          <span className="font-medium text-text">{match.predicted}</span>
        </p>
        <p>
          <span className="text-text-muted">What happened: </span>
          <span className={`font-medium ${success ? "text-win" : "text-text"}`}>{match.actual}</span>
        </p>
      </div>
    </li>
  );
}

export function AccuracyDashboard() {
  const [data, setData] = useState<AccuracySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchPage, setMatchPage] = useState(0);

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

  useEffect(() => {
    setMatchPage(0);
  }, [data?.count]);

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
  const gradedMatches = data.worstMisses;
  const matchPageCount = Math.max(1, Math.ceil(gradedMatches.length / MATCHES_PAGE_SIZE));
  const safeMatchPage = Math.min(matchPage, matchPageCount - 1);
  const pagedMatches = gradedMatches.slice(
    safeMatchPage * MATCHES_PAGE_SIZE,
    safeMatchPage * MATCHES_PAGE_SIZE + MATCHES_PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      {data.sampleMaturity === "early" && (
        <Card className="border-brand/30 bg-brand-tint/10 p-5">
          <p className="text-sm text-text-muted">
            <strong className="text-text">Early sample.</strong> {data.count} of{" "}
            {MIN_ACCURACY_SAMPLE}+ matches needed before calibration curves are meaningful. Metrics
            below are directional only.{" "}
            <Link href="/how-it-works" className="font-semibold text-brand hover:underline">
              How we grade picks
            </Link>
          </p>
        </Card>
      )}

      <Card className="border-border bg-surface-2/40 p-5">
        <h2 className="text-sm font-bold">How to read this page</h2>
        <ul className="mt-3 space-y-2 text-sm text-text-muted">
          <li>
            <strong className="text-text">Favorite pick rate</strong> — did our most likely outcome
            (home win, draw, or away win) match the result?
          </li>
          <li>
            <strong className="text-text">Graded matches</strong> — every confirmed game with stored
            odds, sorted biggest miss first. Green = favorite pick right; red = we called the wrong
            most-likely outcome.
          </li>
          <li>
            <strong className="text-text">Advanced stats</strong> — optional math (Brier, confidence
            bands) for how tight the probability numbers were, not just who we picked.
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

      {gradedMatches.length > 0 && (
        <Card className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Graded matches</h2>
              <p className="mt-1 text-xs text-text-muted">
                {gradedMatches.length} confirmed match{gradedMatches.length === 1 ? "" : "es"} · sorted
                by probability error (worst first)
              </p>
            </div>
            {matchPageCount > 1 && (
              <p className="num text-xs font-semibold text-text-muted">
                Page {safeMatchPage + 1} of {matchPageCount}
              </p>
            )}
          </div>
          <ul className="mt-4 space-y-3">
            {pagedMatches.map((m) => (
              <GradedMatchRow key={m.matchId} match={m} />
            ))}
          </ul>
          {matchPageCount > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-text-muted">
                Showing {safeMatchPage * MATCHES_PAGE_SIZE + 1}–
                {Math.min((safeMatchPage + 1) * MATCHES_PAGE_SIZE, gradedMatches.length)} of{" "}
                {gradedMatches.length}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 min-h-9 px-3"
                  disabled={safeMatchPage === 0}
                  onClick={() => setMatchPage(safeMatchPage - 1)}
                >
                  <ChevronLeft size={16} />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 min-h-9 px-3"
                  disabled={safeMatchPage >= matchPageCount - 1}
                  onClick={() => setMatchPage(safeMatchPage + 1)}
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
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

      {data.eloBaseline && data.eloBaseline.count > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-bold">AI vs pure Elo</h2>
          <p className="mt-1 text-sm text-text-muted">
            For {data.eloBaseline.count} graded match{data.eloBaseline.count === 1 ? "" : "es"}, we
            compare stored AI odds to Elo-only probabilities at kickoff (pre-match ratings, no LLM).
            {data.eloBaseline.brierImprovement != null && data.eloBaseline.brierImprovement > 0
              ? " Lower Brier is better — AI is ahead on average."
              : data.eloBaseline.brierImprovement != null && data.eloBaseline.brierImprovement < 0
                ? " Lower Brier is better — pure Elo is ahead on average."
                : " Scores are tied so far."}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-lg bg-surface-2 p-3">
              <div className="text-xs text-text-muted">AI Brier</div>
              <div className="num mt-1 font-bold">{data.eloBaseline.avgAiBrier?.toFixed(3) ?? "—"}</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <div className="text-xs text-text-muted">Elo-only Brier</div>
              <div className="num mt-1 font-bold">{data.eloBaseline.avgEloBrier?.toFixed(3) ?? "—"}</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <div className="text-xs text-text-muted">AI improvement</div>
              <div className="num mt-1 font-bold">
                {data.eloBaseline.brierImprovement != null
                  ? `${data.eloBaseline.brierImprovement >= 0 ? "+" : ""}${data.eloBaseline.brierImprovement.toFixed(3)}`
                  : "—"}
              </div>
            </div>
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
              <h3 className="text-sm font-bold">Favorite pick rate by confidence</h3>
              <p className="mt-1 text-xs text-text-muted">
                How often our most likely outcome (home, draw, or away) was right, grouped by how
                confident that pick was. This is not full probability calibration — draws count as a
                miss when we favored a team.
              </p>
              <div className="mt-3 space-y-3">
                {data.calibrationBins.map((b) => (
                  <div key={b.bin}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-semibold text-text">Favorite around {b.bin}</span>
                      <span className="num text-text-muted">
                        pick correct {b.actual}% of the time ({b.count} match{b.count === 1 ? "" : "es"})
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
