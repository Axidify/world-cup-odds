"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";

type StatusResponse = {
  simulation: { runAt: string } | null;
  stale: { stale: boolean; resultsConfirmedSinceRun: number };
  staleMessage: string | null;
  pendingResults: number;
  poller: { lastResultsPollAt: string | null; lastNewsPollAt: string | null };
  pipeline?: {
    config: { enabled: boolean; simulateOnResults: boolean };
    state: { status: string; error: string | null };
    active: boolean;
  };
};

function formatPollTime(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString();
}

export function TournamentStatusBanner() {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tournament/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!status) return null;

  const pipelineActive = status.pipeline?.active;
  const showStale = status.stale.stale && status.staleMessage && !pipelineActive;
  const showPending = status.pendingResults > 0;
  const showPoller = !status.poller.lastResultsPollAt;
  const showPipeline = pipelineActive || status.pipeline?.state.status === "failed";

  if (!showStale && !showPending && !showPoller && !showPipeline) return null;

  return (
    <Card className="border-brand/40 bg-brand-tint/30 p-4" role="status">
      <div className="flex gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-brand" />
        <div className="space-y-1 text-sm">
          {showPipeline && (
            <p className="font-semibold text-text">
              <RefreshCw
                size={14}
                className={`mr-1 inline ${pipelineActive ? "animate-spin" : ""}`}
              />
              {pipelineActive
                ? "Auto-updating odds and bracket…"
                : status.pipeline?.state.error ?? "Auto-pipeline failed — re-run simulation manually"}
            </p>
          )}
          {showStale && (
            <p className="font-semibold text-text">
              <RefreshCw size={14} className="mr-1 inline" />
              {status.staleMessage}
            </p>
          )}
          {showPending && (
            <p className="text-text-muted">
              {status.pendingResults} score{status.pendingResults === 1 ? "" : "s"} awaiting confirmation
              {" · "}
              <a href="/office" className="font-semibold text-brand hover:underline">
                Review on Office
              </a>
            </p>
          )}
          {showPoller && (
            <p className="text-xs text-text-muted">
              Results poller has not run yet — start with <code className="text-text">npm run start:all</code> or{" "}
              <code className="text-text">npm run poller</code>.
            </p>
          )}
          {status.poller.lastResultsPollAt && (
            <p className="text-[10px] text-text-muted">
              Last results sync {formatPollTime(status.poller.lastResultsPollAt)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
