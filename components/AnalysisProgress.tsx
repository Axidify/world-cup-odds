"use client";

import { Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { BulkJobState } from "@/lib/ai/bulk-job";

type Props = {
  job: BulkJobState;
  onCancel?: () => void;
};

export function AnalysisProgress({ job, onCancel }: Props) {
  const done = job.completed + job.failed;
  const pct = job.total > 0 ? Math.round((done / job.total) * 100) : 0;
  const running = job.status === "running";
  const catalogTotal = job.catalogTotal ?? 0;
  const cachedAtStart = job.cachedAtStart ?? 0;
  const overallReady =
    catalogTotal > 0 ? Math.min(catalogTotal, cachedAtStart + job.completed) : null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {running
            ? `Analyzing ${job.total} missing matchup${job.total === 1 ? "" : "s"}…`
            : `Bulk analyze ${job.status}`}
        </p>
        {running && onCancel && (
          <Button variant="ghost" className="h-9 min-h-0 px-2" onClick={onCancel}>
            <Square size={14} />
            Cancel
          </Button>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-brand transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="num flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        <span>
          {done} / {job.total} this run ({pct}%)
        </span>
        {overallReady != null && catalogTotal > 0 && (
          <span>
            {overallReady} / {catalogTotal} core cached
          </span>
        )}
        {job.failed > 0 && <span className="text-loss">{job.failed} failed</span>}
        {job.model && (
          <span>
            {job.provider ? `${job.provider} · ` : ""}
            {job.model}
          </span>
        )}
      </div>
      {job.current && running && (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 size={12} className="animate-spin shrink-0" />
          <span className="truncate">{job.current}</span>
        </p>
      )}
      {job.error && job.status !== "running" && (
        <p className="text-xs text-loss">{job.error}</p>
      )}
    </div>
  );
}
