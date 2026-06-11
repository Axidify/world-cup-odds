"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { BulkJobState } from "@/lib/ai/bulk-job";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { Button } from "@/components/ui/Button";

type Targets = { total: number; cached: number; remaining?: number };

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
        toast("Match analysis complete");
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

  const pending = targets ? (targets.remaining ?? targets.total - targets.cached) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={loading || running}
          onClick={() => start(false)}
        >
          {loading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          Analyze all matches
        </Button>
        <Button variant="secondary" disabled={loading || running} onClick={() => start(true)}>
          <RefreshCw size={16} />
          Re-analyze all
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        <strong className="font-semibold text-text">Analyze all</strong> fills missing predictions only.{" "}
        <strong className="font-semibold text-text">Re-analyze all</strong> forces a fresh LLM pass on every match.
      </p>
      {pending != null && !running && (
        <p className="text-xs text-text-muted">
          {targets!.cached} / {targets!.total} pairings analyzed
          {pending > 0 ? ` · ${pending} need analysis` : " · up to date"}
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
