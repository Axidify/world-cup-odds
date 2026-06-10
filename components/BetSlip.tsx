"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/utils/currency";

type Bettor = { id: string; name: string };

type MatchLine = {
  selection: "home" | "draw" | "away";
  label: string;
  probabilityPct: number;
  decimalOdds: number;
};

type Props =
  | { mode: "match"; matchId: string }
  | { mode: "champion"; teamId: string; teamName: string };

export function BetSlip(props: Props) {
  const [bettors, setBettors] = useState<Bettor[]>([]);
  const [bettorId, setBettorId] = useState("");
  const [newName, setNewName] = useState("");
  const [selection, setSelection] = useState<string>("");
  const [stake, setStake] = useState("10");
  const [lines, setLines] = useState<MatchLine[]>([]);
  const [championLine, setChampionLine] = useState<{
    probabilityPct: number;
    decimalOdds: number;
  } | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadBettors = useCallback(async () => {
    const res = await fetch("/api/bettors");
    const data = await res.json();
    setBettors(data.bettors ?? []);
    if (!bettorId && data.bettors?.[0]) setBettorId(data.bettors[0].id);
  }, [bettorId]);

  const loadLines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (props.mode === "match") {
        const res = await fetch(`/api/betting/lines?matchId=${props.matchId}`);
        const data = await res.json();
        setLocked(Boolean(data.locked));
        setLines(data.snapshot?.lines ?? []);
        if (data.snapshot?.lines?.[0]) {
          setSelection((prev) => prev || data.snapshot.lines[0].selection);
        }
      } else {
        const res = await fetch(`/api/betting/lines?teamId=${props.teamId}`);
        const data = await res.json();
        setLocked(Boolean(data.locked));
        setChampionLine(data.line ?? null);
        setSelection(props.teamId);
      }
    } catch {
      setError("Could not load odds");
    } finally {
      setLoading(false);
    }
  }, [props]);

  useEffect(() => {
    void loadBettors();
    void loadLines();
  }, [loadBettors, loadLines]);

  const activeLine = useMemo(() => {
    if (props.mode === "champion") return championLine;
    return lines.find((l) => l.selection === selection) ?? null;
  }, [props.mode, championLine, lines, selection]);

  const stakeNum = Number(stake);
  const payout =
    activeLine && Number.isFinite(stakeNum) && stakeNum > 0
      ? Math.round(stakeNum * activeLine.decimalOdds * 100) / 100
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
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const body =
        props.mode === "match"
          ? {
              bettorId,
              betType: "match" as const,
              matchId: props.matchId,
              selection,
              stakeMyr: stakeNum,
            }
          : {
              bettorId,
              betType: "champion" as const,
              selection: props.teamId,
              stakeMyr: stakeNum,
            };

      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bet failed");
      setSuccess(`Bet placed — potential return ${formatMoney(data.bet?.potentialPayoutMyr ?? payout ?? 0)}`);
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

  if (props.mode === "match" && lines.length === 0) {
    return (
      <Card className="p-6 text-sm text-text-muted">
        No AI odds yet — run match analysis first, then place a bet.
      </Card>
    );
  }

  if (props.mode === "champion" && !championLine) {
    return (
      <Card className="p-6 text-sm text-text-muted">
        No champion odds — run tournament simulation first.
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">
        {props.mode === "match" ? "Place bet" : `Bet on ${props.teamName}`}
      </h2>

      {locked && (
        <p className="mt-2 text-xs font-semibold text-loss">
          Betting locked{props.mode === "champion" ? " — tournament lock passed" : " — kickoff passed"}
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

        {props.mode === "match" && (
          <div className="flex flex-wrap gap-2">
            {lines.map((line) => (
              <button
                key={line.selection}
                type="button"
                onClick={() => setSelection(line.selection)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  selection === line.selection
                    ? "border-brand bg-brand-tint text-text"
                    : "border-border bg-surface-2 text-text-muted hover:border-brand"
                }`}
              >
                <span className="block font-semibold">{line.label}</span>
                <span className="num text-money">{line.decimalOdds.toFixed(2)}</span>
                <span className="num text-text-muted"> · {line.probabilityPct.toFixed(1)}%</span>
              </button>
            ))}
          </div>
        )}

        {props.mode === "champion" && championLine && (
          <p className="num text-sm text-text-muted">
            {championLine.probabilityPct.toFixed(2)}% · odds {championLine.decimalOdds.toFixed(2)}
          </p>
        )}

        <label className="block text-xs text-text-muted">
          Stake (MYR)
          <input
            type="number"
            min={1}
            step={1}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-surface px-2 py-2 text-sm"
          />
        </label>

        {payout != null && (
          <p className="num text-sm">
            Potential return <span className="font-semibold text-money">{formatMoney(payout)}</span>
          </p>
        )}

        {error && <p className="text-xs text-loss">{error}</p>}
        {success && <p className="text-xs text-win">{success}</p>}

        <Button disabled={locked || submitting || !bettorId} onClick={() => void submit()}>
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          Place bet
        </Button>
      </div>
    </Card>
  );
}
