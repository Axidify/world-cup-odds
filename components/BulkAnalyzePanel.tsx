"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RefreshCw } from "lucide-react";
import { AdminPinDialog } from "@/components/AdminPinDialog";
import { useToast } from "@/components/ui/Toast";
import type { BulkJobState } from "@/lib/ai/bulk-job";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { Button } from "@/components/ui/Button";

type Targets = {
  total: number;
  cached: number;
  remaining?: number;
  baselineMissing?: number;
};

type DialogMode = "start" | "cancel" | null;

function optimisticJob(total: number, targets: Targets | null): BulkJobState {
  return {
    status: "running",
    total,
    completed: 0,
    skipped: 0,
    failed: 0,
    catalogTotal: targets?.total ?? total,
    cachedAtStart: targets?.cached ?? 0,
    current: "Starting…",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    provider: null,
    model: null,
    refresh: false,
  };
}

export function BulkAnalyzePanel() {
  const router = useRouter();
  const { toast } = useToast();
  const progressRef = useRef<HTMLDivElement>(null);
  const [job, setJob] = useState<BulkJobState | null>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);

  const scrollProgressIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      progressRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/analyze/bulk");
      const data = await res.json();
      setJob(data.job);
      setTargets(data.targets);
      return data.job as BulkJobState;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void poll();
  }, [poll]);

  const running = job?.status === "running";
  const showProgress = starting || running;

  useEffect(() => {
    if (!showProgress) return;

    const id = setInterval(async () => {
      const next = await poll();
      if (!next) return;

      if (next.status === "running") {
        setStarting(false);
        return;
      }

      clearInterval(id);
      setStarting(false);

      if (next.status === "completed") {
        toast(
          next.total === 0
            ? "All predictions are up to date"
            : `Analyzed ${next.completed} matchup${next.completed === 1 ? "" : "s"}`,
        );
        router.refresh();
      } else if (next.status === "failed") {
        toast(next.error ?? "Bulk analyze failed");
      } else if (next.status === "cancelled") {
        toast("Bulk analyze cancelled");
      }
    }, 1000);

    return () => clearInterval(id);
  }, [showProgress, poll, router, toast]);

  async function start(pin: string) {
    const runTotal = targets?.remaining ?? 0;
    setError(null);
    setDialogMode(null);
    setStarting(true);
    setJob(optimisticJob(runTotal, targets));
    scrollProgressIntoView();
    setLoading(true);

    try {
      const res = await fetch("/api/analyze/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: false, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");

      setJob(data.job);
      if (data.job?.status === "running") {
        setStarting(false);
        scrollProgressIntoView();
      } else {
        setStarting(false);
        if (data.job?.status === "completed" && data.job.total === 0) {
          toast("All predictions are up to date");
        }
      }
      void poll();
    } catch (err) {
      setStarting(false);
      setJob(null);
      setError(err instanceof Error ? err.message : "Failed to start");
      setDialogMode("start");
    } finally {
      setLoading(false);
    }
  }

  async function cancel(pin: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel");
      setDialogMode(null);
      setStarting(false);
      await poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setLoading(false);
    }
  }

  const pending = targets?.remaining ?? null;
  const gapOnly =
    pending != null &&
    targets != null &&
    pending > 0 &&
    (targets.baselineMissing ?? pending) === 0;

  return (
    <div className="space-y-3">
      {showProgress && job && (
        <div ref={progressRef}>
          <AnalysisProgress
            job={{ ...job, status: "running" }}
            onCancel={() => {
              setError(null);
              setDialogMode("cancel");
            }}
          />
        </div>
      )}

      <Button
        variant="primary"
        disabled={loading || running || starting || pending === 0}
        onClick={() => {
          setError(null);
          setDialogMode("start");
        }}
      >
        {loading && dialogMode === "start" ? (
          <RefreshCw size={16} className="animate-spin" />
        ) : (
          <Play size={16} />
        )}
        {pending != null && pending > 0
          ? `Analyze missing (${pending})`
          : "All analyzed"}
      </Button>

      <AdminPinDialog
        open={dialogMode === "start"}
        onClose={() => {
          if (!loading && !starting) setDialogMode(null);
        }}
        title="Analyze missing predictions"
        description="Runs LLM analysis for pairings without a fresh AI prediction (Elo seeds count as missing)."
        confirmLabel="Start analysis"
        loading={loading && dialogMode === "start"}
        error={error}
        onSubmit={start}
      />

      <AdminPinDialog
        open={dialogMode === "cancel"}
        onClose={() => {
          if (!loading) setDialogMode(null);
        }}
        title="Cancel bulk analyze"
        description="Stop the in-progress analysis run."
        confirmLabel="Cancel run"
        loading={loading}
        error={error}
        onSubmit={cancel}
      />

      <p className="text-xs text-text-muted">
        Skips fixtures that already have a fresh LLM prediction. Elo-seeded rows are re-analyzed.
      </p>
      {targets && !showProgress && (
        <p className="text-xs text-text-muted">
          {targets.cached} / {targets.total} core pairings have LLM predictions
          {pending === 0
            ? " · up to date"
            : gapOnly
              ? ` · ${pending} bracket-specific pairing${pending === 1 ? "" : "s"} need analysis`
              : ` · ${pending} to analyze this run`}
        </p>
      )}
      {!showProgress && job?.error && job.status !== "idle" && (
        <p className={`text-xs ${job.status === "cancelled" ? "text-text-muted" : "text-loss"}`}>
          {job.error}
        </p>
      )}
    </div>
  );
}
