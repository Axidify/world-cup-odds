"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RefreshCw } from "lucide-react";
import { AdminPinDialog } from "@/components/AdminPinDialog";
import { useToast } from "@/components/ui/Toast";
import type { BulkJobState } from "@/lib/ai/bulk-job";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { Button } from "@/components/ui/Button";
import { useAdminPinGate, type AdminPinAction } from "@/lib/hooks/use-admin-pin-action";

type Targets = {
  total: number;
  cached: number;
  remaining?: number;
  baselineMissing?: number;
  simulationMissing?: number;
  staleMissing?: number;
};

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
  const [starting, setStarting] = useState(false);
  const startPin = useAdminPinGate({
    title: "Analyze missing predictions",
    description:
      "Runs LLM analysis for pairings without a fresh AI prediction (Elo seeds count as missing).",
    confirmLabel: "Start analysis",
  });
  const cancelPin = useAdminPinGate({
    title: "Cancel bulk analyze",
    description: "Stop the in-progress analysis run.",
    confirmLabel: "Cancel run",
  });

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

  const running = job?.status === "running";
  const showProgress = starting || running;
  const pinLoading = startPin.loading || cancelPin.loading;

  useEffect(() => {
    void poll();
    const id = setInterval(() => {
      if (!showProgress) void poll();
    }, 15_000);
    return () => clearInterval(id);
  }, [poll, showProgress]);

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
    }, 2500);

    return () => clearInterval(id);
  }, [showProgress, poll, router, toast]);

  const startAction: AdminPinAction = async (pin) => {
    const runTotal = targets?.remaining ?? 0;
    const res = await fetch("/api/analyze/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: false, pin }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error ?? "Failed to start" };
    }

    setStarting(true);
    setJob(optimisticJob(runTotal, targets));
    scrollProgressIntoView();

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
    return { ok: true };
  };

  const cancelAction: AdminPinAction = async (pin) => {
    const res = await fetch("/api/analyze/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error ?? "Failed to cancel" };
    }
    setStarting(false);
    await poll();
    return { ok: true };
  };

  const pending = targets?.remaining ?? null;
  const simMissing = targets?.simulationMissing ?? null;
  const baselineMissing = targets?.baselineMissing ?? null;
  const staleMissing = targets?.staleMissing ?? null;
  const gapOnly =
    pending != null &&
    pending > 0 &&
    baselineMissing === 0 &&
    (staleMissing ?? 0) === 0;
  const staleOnly =
    pending != null &&
    pending > 0 &&
    baselineMissing === 0 &&
    (simMissing ?? 0) === 0 &&
    (staleMissing ?? 0) > 0;

  return (
    <div className="space-y-3">
      {showProgress && job && (
        <div ref={progressRef}>
          <AnalysisProgress
            job={{ ...job, status: "running" }}
            onCancel={() => {
              cancelPin.setError(null);
              void cancelPin.request(cancelAction);
            }}
          />
        </div>
      )}

      <Button
        variant="primary"
        disabled={pinLoading || running || starting || pending === 0}
        onClick={() => {
          startPin.setError(null);
          void startPin.request(startAction);
        }}
      >
        {startPin.loading ? (
          <RefreshCw size={16} className="animate-spin" />
        ) : (
          <Play size={16} />
        )}
        {pending != null && pending > 0
          ? `Analyze missing (${pending})`
          : "All analyzed"}
      </Button>

      <AdminPinDialog {...startPin.dialogProps} />
      <AdminPinDialog {...cancelPin.dialogProps} />

      <p className="text-xs text-text-muted">
        Skips fixtures that already have a fresh LLM prediction. Elo-seeded rows and bracket-path
        gaps are included.
      </p>
      {targets && !showProgress && (
        <p className="text-xs text-text-muted">
          {targets.cached} / {targets.total} core pairings have fresh LLM predictions
          {pending === 0
            ? " · up to date"
            : staleOnly
              ? ` · ${staleMissing} stale prediction${staleMissing === 1 ? "" : "s"} to refresh`
              : gapOnly
                ? ` · ${simMissing ?? pending} bracket-path pairing${(simMissing ?? pending) === 1 ? "" : "s"} needed before simulation`
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
