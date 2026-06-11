"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatStageLabel } from "@/lib/utils/match-label";
import { formatUtcDate } from "@/lib/utils/dates";

type PendingRow = {
  matchId: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  stage: string;
  date: string;
  source: string | null;
};

export function PendingResultsPanel() {
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/results/pending");
      const data = await res.json();
      setPending(data.pending ?? []);
    } catch {
      setPending([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function confirm(matchId: string) {
    if (!pin.trim()) {
      setError("Enter ADMIN_PIN to confirm results");
      return;
    }
    setLoading(matchId);
    setError(null);
    try {
      const res = await fetch(`/api/results/${matchId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Confirm failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setLoading(null);
    }
  }

  if (pending.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-text-muted">
        No pending results — poller syncs scores as matches finish.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-text-muted">
          Admin PIN
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="mt-1 block w-40 rounded border border-border bg-surface px-2 py-1.5 text-sm"
            autoComplete="off"
          />
        </label>
      </div>
      {error && <p className="text-xs text-loss">{error}</p>}
      <div className="space-y-2">
        {pending.map((row) => (
          <Card key={row.matchId} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold">
                {row.homeName} {row.homeScore}–{row.awayScore} {row.awayName}
              </p>
              <p className="text-xs text-text-muted">
                {formatStageLabel(row.stage)} · {formatUtcDate(row.date)}
                {row.source ? ` · via ${row.source}` : ""}
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={loading === row.matchId}
              onClick={() => confirm(row.matchId)}
            >
              {loading === row.matchId ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Confirm
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
