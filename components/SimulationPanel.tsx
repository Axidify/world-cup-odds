"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  hasSimulation: boolean;
  lastRunAt: string | null;
};

export function SimulationPanel({ hasSimulation, lastRunAt }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingCount, setMissingCount] = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () =>
      fetch("/api/analyze/bulk")
        .then((r) => r.json())
        .then((d) => {
          if (active) setBulkRunning(Boolean(d.active) || d.job?.status === "running");
        })
        .catch(() => {});
    void check();
    const id = setInterval(check, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  async function runSimulation() {
    setLoading(true);
    setError(null);
    setMissingCount(null);
    try {
      const res = await fetch("/api/analyze/tournament", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.missing) && data.missing.length > 0) {
          setMissingCount(data.missing.length);
        }
        throw new Error(data.error ?? "Simulation failed");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="primary" onClick={runSimulation} disabled={loading || bulkRunning}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
        {loading ? "Simulating…" : hasSimulation ? "Re-run simulation" : "Run simulation"}
      </Button>
      {lastRunAt && (
        <p className="num text-xs text-text-muted">
          Last run {new Date(lastRunAt).toLocaleString()}
        </p>
      )}
      {missingCount != null && (
        <p className="text-xs text-loss">
          {missingCount} match pairing(s) still need AI analysis before simulating.
        </p>
      )}
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
