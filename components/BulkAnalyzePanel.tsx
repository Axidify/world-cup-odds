"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import type { BulkJobState } from "@/lib/ai/bulk-job";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { Button } from "@/components/ui/Button";

type Targets = { total: number; cached: number };

export function BulkAnalyzePanel() {
  const [job, setJob] = useState<BulkJobState | null>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/analyze/bulk");
      const data = await res.json();
      setJob(data.job);
      setTargets(data.targets);
      setActive(Boolean(data.active));
      return data.job as BulkJobState;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void poll();
  }, [poll]);

  const running = active || job?.status === "running";

  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      const next = await poll();
      if (next && next.status === "completed") {
        clearInterval(id);
        window.location.reload();
      }
    }, 2000);
    return () => clearInterval(id);
  }, [running, poll]);

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
      setActive(true);
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

  const pending = targets ? targets.total - targets.cached : null;

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
      {pending != null && !running && (
        <p className="text-xs text-text-muted">
          {targets!.cached} / {targets!.total} pairings cached
          {pending > 0 ? ` · ${pending} remaining` : " · up to date"}
        </p>
      )}
      {error && <p className="text-xs text-loss">{error}</p>}
      {running && job && (
        <AnalysisProgress job={{ ...job, status: "running" }} onCancel={cancel} />
      )}
      {!running && job?.error && job.status !== "idle" && (
        <p className="text-xs text-loss">{job.error}</p>
      )}
    </div>
  );
}
