"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RefreshCw } from "lucide-react";
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

export function BulkAnalyzePanel() {
  const router = useRouter();
  const { toast } = useToast();
  const [job, setJob] = useState<BulkJobState | null>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      const next = await poll();
      if (next && next.status === "completed") {
        clearInterval(id);
        toast(
          next.total === 0
            ? "All predictions are up to date"
            : `Analyzed ${next.completed} matchup${next.completed === 1 ? "" : "s"}`,
        );
        router.refresh();
      }
    }, 2000);
    return () => clearInterval(id);
  }, [running, poll, router, toast]);

  async function start(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");
      setJob(data.job);
      if (data.job?.status === "completed" && data.job.total === 0) {
        toast("All predictions are up to date");
      }
      void poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    await fetch("/api/analyze/bulk", { method: "DELETE" });
    await poll();
  }

  const pending = targets?.remaining ?? null;
  const gapOnly =
    pending != null &&
    targets != null &&
    pending > 0 &&
    (targets.baselineMissing ?? pending) === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={loading || running || pending === 0}
          onClick={() => start(false)}
        >
          {loading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          {pending != null && pending > 0
            ? `Analyze missing (${pending})`
            : "All analyzed"}
        </Button>
        <Button variant="secondary" disabled={loading || running} onClick={() => start(true)}>
          <RefreshCw size={16} />
          Re-analyze all
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        <strong className="font-semibold text-text">Analyze missing</strong> runs only uncached
        predictions (group matches, top-24 pairings, and bracket-path gaps).{" "}
        <strong className="font-semibold text-text">Re-analyze all</strong> forces a fresh LLM pass.
      </p>
      {targets && !running && (
        <p className="text-xs text-text-muted">
          {targets.cached} / {targets.total} core pairings cached
          {pending === 0
            ? " · up to date"
            : gapOnly
              ? ` · ${pending} bracket-specific pairing${pending === 1 ? "" : "s"} need analysis`
              : ` · ${pending} to analyze this run`}
        </p>
      )}
      {error && <p className="text-xs text-loss">{error}</p>}
      {running && job && (
        <AnalysisProgress job={{ ...job, status: "running" }} onCancel={cancel} />
      )}
      {!running && job?.error && job.status !== "idle" && (
        <p className={`text-xs ${job.status === "cancelled" ? "text-text-muted" : "text-loss"}`}>
          {job.error}
        </p>
      )}
    </div>
  );
}
