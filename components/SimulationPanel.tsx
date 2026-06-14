"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trophy } from "lucide-react";
import { AdminPinDialog } from "@/components/AdminPinDialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAdminPinGate, type AdminPinAction } from "@/lib/hooks/use-admin-pin-action";

type Props = {
  hasSimulation: boolean;
  lastRunAt: string | null;
};

export function SimulationPanel({ hasSimulation, lastRunAt }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [missingCount, setMissingCount] = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const pinGate = useAdminPinGate({
    title: hasSimulation ? "Re-run simulation" : "Run simulation",
    description:
      "Monte Carlo champion odds and bracket projections. Stale predictions are re-analyzed automatically before simulating.",
    confirmLabel: hasSimulation ? "Re-run" : "Run simulation",
  });

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

  const runSimulation: AdminPinAction = async (pin) => {
    setMissingCount(null);
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
      return { ok: false, status: res.status, error: data.error ?? "Simulation failed" };
    }

    toast(hasSimulation ? "Simulation updated" : "Simulation complete");
    router.refresh();
    return { ok: true };
  };

  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        onClick={() => {
          pinGate.setError(null);
          setMissingCount(null);
          void pinGate.request(runSimulation);
        }}
        disabled={pinGate.loading || bulkRunning}
      >
        {pinGate.loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Trophy size={16} />
        )}
        {hasSimulation ? "Re-run simulation" : "Run simulation"}
      </Button>

      <AdminPinDialog
        {...pinGate.dialogProps}
        title={hasSimulation ? "Re-run simulation" : "Run simulation"}
        confirmLabel={hasSimulation ? "Re-run" : "Run simulation"}
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
