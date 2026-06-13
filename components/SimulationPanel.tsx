"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trophy } from "lucide-react";
import { AdminPinDialog } from "@/components/AdminPinDialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Props = {
  hasSimulation: boolean;
  lastRunAt: string | null;
};

export function SimulationPanel({ hasSimulation, lastRunAt }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingCount, setMissingCount] = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  async function runSimulation(pin: string) {
    setError(null);
    setMissingCount(null);
    setLoading(true);

    try {
      const res = await fetch("/api/analyze/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.missing) && data.missing.length > 0) {
          setMissingCount(data.missing.length);
        }
        throw new Error(data.error ?? "Simulation failed");
      }

      setDialogOpen(false);
      toast(hasSimulation ? "Simulation updated" : "Simulation complete");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setDialogOpen(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        onClick={() => {
          setError(null);
          setMissingCount(null);
          setDialogOpen(true);
        }}
        disabled={loading || bulkRunning}
      >
        {loading && dialogOpen ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Trophy size={16} />
        )}
        {hasSimulation ? "Re-run simulation" : "Run simulation"}
      </Button>

      <AdminPinDialog
        open={dialogOpen}
        onClose={() => {
          if (!loading) setDialogOpen(false);
        }}
        title={hasSimulation ? "Re-run simulation" : "Run simulation"}
        description="Monte Carlo champion odds and bracket projections. Requires fresh LLM predictions — run Analyze missing first if needed."
        confirmLabel={hasSimulation ? "Re-run" : "Run simulation"}
        loading={loading}
        error={error}
        onSubmit={runSimulation}
      />

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
    </div>
  );
}
