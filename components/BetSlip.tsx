"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/utils/currency";

type Bettor = { id: string; name: string };

type Props = { teamId: string; teamName: string };

export function BetSlip({ teamId, teamName }: Props) {
  const { toast } = useToast();
  const [bettors, setBettors] = useState<Bettor[]>([]);
  const [bettorId, setBettorId] = useState("");
  const [newName, setNewName] = useState("");
  const [championLine, setChampionLine] = useState<{
    probabilityPct: number;
    decimalOdds: number;
  } | null>(null);
  const [fixedStake, setFixedStake] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [simulationStale, setSimulationStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBettors = useCallback(async () => {
    try {
      const res = await fetch("/api/bettors");
      const data = await res.json();
      setBettors(data.bettors ?? []);
      setBettorId((prev) => prev || data.bettors?.[0]?.id || "");
    } catch {
      setError("Could not load bettors");
    }
  }, []);

  const loadLine = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/betting/lines?teamId=${teamId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load odds");
      setLocked(Boolean(data.locked));
      setSimulationStale(Boolean(data.simulationStale));
      setChampionLine(data.line ?? null);
      setFixedStake(typeof data.fixedStakeMyr === "number" ? data.fixedStakeMyr : null);
    } catch {
      setError("Could not load odds");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void loadBettors();
    void loadLine();
  }, [loadBettors, loadLine]);

  const payout =
    championLine && fixedStake != null
      ? Math.round(fixedStake * championLine.decimalOdds * 100) / 100
      : null;

  async function addBettor() {
    if (!newName.trim()) return;
    const res = await fetch("/api/bettors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not add bettor");
      return;
    }
    setNewName("");
    await loadBettors();
    if (data.bettor?.id) setBettorId(data.bettor.id);
  }

  async function submit() {
    if (!bettorId) {
      setError("Pick or add a bettor");
      return;
    }
    if (fixedStake == null) {
      setError("Stake unavailable — try refreshing");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bettorId,
          betType: "champion",
          selection: teamId,
          stakeMyr: fixedStake,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bet failed");
      toast(
        `Bet placed — potential return ${formatMoney(data.bet?.potentialPayoutMyr ?? payout ?? 0)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bet failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6 text-sm text-text-muted">
        <Loader2 size={16} className="animate-spin" /> Loading odds…
      </Card>
    );
  }

  if (!championLine) {
    return (
      <Card className="p-6 text-sm text-text-muted">
        No champion odds — run tournament simulation first.
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Bet on {teamName} to win the World Cup</h2>

      {locked && (
        <p className="mt-2 text-xs font-semibold text-loss">
          Betting locked — tournament lock passed
        </p>
      )}
      {simulationStale && !locked && (
        <p className="mt-2 text-xs font-semibold text-loss">
          Champion odds are stale — re-run simulation before betting.
        </p>
      )}

      <div className="mt-4 space-y-3">
        <label className="block text-xs text-text-muted">
          Bettor
          <select
            value={bettorId}
            onChange={(e) => setBettorId(e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-surface px-2 py-2 text-sm"
          >
            <option value="">Select…</option>
            {bettors.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add colleague"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded border border-border bg-surface px-2 py-2 text-sm"
          />
          <Button variant="secondary" onClick={() => void addBettor()}>
            Add
          </Button>
        </div>

        <p className="num text-sm text-text-muted">
          {championLine.probabilityPct.toFixed(2)}% · odds {championLine.decimalOdds.toFixed(2)}
        </p>

        {fixedStake != null && (
          <p className="text-sm">
            Stake <span className="num font-semibold">{formatMoney(fixedStake)}</span>{" "}
            <span className="text-xs text-text-muted">(fixed for everyone)</span>
          </p>
        )}

        {payout != null && (
          <p className="num text-sm">
            Potential return <span className="font-semibold text-money">{formatMoney(payout)}</span>
          </p>
        )}

        {error && <p className="text-xs text-loss">{error}</p>}

        <Button
          disabled={locked || submitting || !bettorId || simulationStale}
          onClick={() => void submit()}
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          Place RM {fixedStake ?? "—"} bet
        </Button>
      </div>
    </Card>
  );
}
