"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMoney, formatMoneyCompact } from "@/lib/utils/currency";

type LeaderboardRow = {
  bettorId: string;
  name: string;
  netPnl: number;
  roi: number | null;
  wins: number;
  losses: number;
  openExposure: number;
  rank: number;
};

type BetRow = {
  id: string;
  bettorId: string;
  betType: string;
  matchId: string | null;
  matchLabel: string | null;
  selectionLabel: string;
  stakeMyr: number;
  decimalOdds: number;
  status: string;
  payoutMyr: number | null;
  placedAt: string;
};

type SettlementRow = {
  id: string;
  bettorId: string;
  selection: string;
  status: string;
  payoutMyr: number | null;
  settledAt: string | null;
};

type PoolData = {
  summary: {
    poolName: string;
    totalHandle: number;
    totalPaidOut: number;
    openBets: number;
    settledBets: number;
    openExposure: number;
  };
  leaderboard: LeaderboardRow[];
  recentSettlements: SettlementRow[];
};

export function OfficePoolPanel() {
  const [data, setData] = useState<PoolData | null>(null);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [officeRes, betsRes] = await Promise.all([
        fetch("/api/office/leaderboard"),
        fetch("/api/bets?limit=50"),
      ]);
      const office = await officeRes.json();
      const betsData = await betsRes.json();
      setData({
        summary: office.summary,
        leaderboard: office.leaderboard ?? [],
        recentSettlements: office.recentSettlements ?? [],
      });
      setBets(betsData.bets ?? []);
    } catch {
      setError("Could not load office pool");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function voidBet(id: string) {
    if (!pin.trim()) {
      setError("Enter ADMIN_PIN to void bets");
      return;
    }
    setVoiding(id);
    setError(null);
    try {
      const res = await fetch(`/api/bets/${id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Void failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Void failed");
    } finally {
      setVoiding(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-8 text-center text-sm text-text-muted">
        <Loader2 size={18} className="mx-auto animate-spin" />
      </Card>
    );
  }

  if (!data) {
    return <Card className="p-6 text-sm text-loss">{error ?? "Failed to load"}</Card>;
  }

  const nameById = new Map(data.leaderboard.map((r) => [r.bettorId, r.name]));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total handle", value: formatMoney(data.summary.totalHandle) },
          { label: "Paid out", value: formatMoney(data.summary.totalPaidOut) },
          { label: "Open bets", value: String(data.summary.openBets) },
          { label: "Open exposure", value: formatMoney(data.summary.openExposure) },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{stat.label}</p>
            <p className="num mt-1 text-xl font-bold">{stat.value}</p>
          </Card>
        ))}
      </div>

      {data.recentSettlements.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold">Recent settlements</h2>
          <div className="flex flex-wrap gap-2">
            {data.recentSettlements.slice(0, 6).map((s) => (
              <Card key={s.id} className="px-3 py-2 text-xs">
                <span className="font-semibold capitalize">{s.status}</span>
                <span className="text-text-muted"> · {s.selection}</span>
                {s.payoutMyr != null && (
                  <span className="num ml-1 text-money">{formatMoney(s.payoutMyr)}</span>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">Leaderboard</h2>
        <Link href="/office/bets">
          <Button>Place bet</Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="scrollbar-themed overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">Net P&L</th>
              <th className="px-4 py-3 text-right">W-L</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {data.leaderboard.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No bettors yet — add colleagues when placing the first bet.
                </td>
              </tr>
            ) : (
              data.leaderboard.map((row) => (
                <tr key={row.bettorId} className="border-t border-border">
                  <td className="num px-4 py-3 text-text-muted">{row.rank}</td>
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td
                    className={`num px-4 py-3 text-right font-semibold ${
                      row.netPnl > 0 ? "text-win" : row.netPnl < 0 ? "text-loss" : ""
                    }`}
                  >
                    {formatMoneyCompact(row.netPnl)}
                  </td>
                  <td className="num px-4 py-3 text-right text-text-muted">
                    {row.wins}-{row.losses}
                  </td>
                  <td className="num px-4 py-3 text-right text-text-muted">
                    {formatMoney(row.openExposure)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-bold">Recent bets</h2>
          <label className="text-xs text-text-muted">
            Admin PIN (void)
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="mt-1 block w-36 rounded border border-border bg-surface px-2 py-1.5 text-sm"
              autoComplete="off"
            />
          </label>
        </div>
        {error && <p className="mb-2 text-xs text-loss">{error}</p>}
        <Card className="overflow-hidden">
          <div className="scrollbar-themed overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[10px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3">Bettor</th>
                <th className="px-4 py-3">Pick</th>
                <th className="px-4 py-3 text-right">Stake</th>
                <th className="px-4 py-3 text-right">Odds</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No bets placed yet.
                  </td>
                </tr>
              ) : (
                bets.map((bet) => (
                  <tr key={bet.id} className="border-t border-border">
                    <td className="px-4 py-3">{nameById.get(bet.bettorId) ?? bet.bettorId}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {bet.betType === "champion" ? (
                        <>Champion: {bet.selectionLabel}</>
                      ) : (
                        <>
                          <span className="font-semibold text-text">{bet.selectionLabel}</span>
                          {bet.matchLabel && (
                            <span className="mt-0.5 block text-xs">{bet.matchLabel}</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="num px-4 py-3 text-right">{formatMoney(bet.stakeMyr)}</td>
                    <td className="num px-4 py-3 text-right">{bet.decimalOdds.toFixed(2)}</td>
                    <td className="px-4 py-3 capitalize">{bet.status}</td>
                    <td className="px-4 py-3 text-right">
                      {bet.status === "open" && (
                        <Button
                          variant="ghost"
                          disabled={voiding === bet.id}
                          onClick={() => void voidBet(bet.id)}
                        >
                          {voiding === bet.id ? <Loader2 size={12} className="animate-spin" /> : "Void"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
