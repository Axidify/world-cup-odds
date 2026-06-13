"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { AdminPinDialog } from "@/components/AdminPinDialog";
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
  const [confirming, setConfirming] = useState<PendingRow | null>(null);
  const [loading, setLoading] = useState(false);
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

  async function confirm(pin: string) {
    if (!confirming) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/results/${confirming.matchId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Confirm failed");
      setConfirming(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setLoading(false);
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
      <AdminPinDialog
        open={confirming != null}
        onClose={() => {
          if (!loading) setConfirming(null);
        }}
        title="Confirm result"
        description={
          confirming
            ? `${confirming.homeName} ${confirming.homeScore}–${confirming.awayScore} ${confirming.awayName}`
            : undefined
        }
        confirmLabel="Confirm result"
        loading={loading}
        error={error}
        onSubmit={confirm}
      />

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
              disabled={loading && confirming?.matchId === row.matchId}
              onClick={() => {
                setError(null);
                setConfirming(row);
              }}
            >
              {loading && confirming?.matchId === row.matchId ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Confirm
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
