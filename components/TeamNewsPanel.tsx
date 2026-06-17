"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { AdminPinDialog } from "@/components/AdminPinDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAdminPinGate, type AdminPinAction } from "@/lib/hooks/use-admin-pin-action";

type TeamNewsBlock = {
  teamId: string;
  teamName: string;
  elo: number | null;
  summary: string | null;
  fetchedAt: string | null;
  impact: { eloDelta: number; reasons: string[] } | null;
  events: Array<{
    type: string;
    player: string | null;
    detail: string | null;
    source: string | null;
    severity?: string | null;
    keyPlayer?: boolean;
  }>;
};

type NewsResponse = {
  home: TeamNewsBlock | null;
  away: TeamNewsBlock | null;
};

export function TeamNewsPanel({ matchId }: { matchId: string }) {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pinGate = useAdminPinGate({
    title: "Refresh squad news",
    description: "Fetches search results and runs LLM extraction for both teams.",
    confirmLabel: "Refresh",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/news/${matchId}`);
      if (!res.ok) throw new Error("Failed to load team news");
      setData(await res.json());
      setError(null);
    } catch {
      setError("Could not load squad news");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshNews: AdminPinAction = async (pin) => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, pin }),
      });
      const body = (await res.json()) as { error?: string; outcomes?: Record<string, string> };
      if (!res.ok) {
        return { ok: false, status: res.status, error: body.error ?? "Refresh failed" };
      }
      if (body.outcomes && Object.values(body.outcomes).every((o) => o === "failed")) {
        return { ok: false, status: 502, error: "News sync failed for both teams" };
      }
      await load();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "News refresh failed";
      setError(message);
      return { ok: false, status: 500, error: message };
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 text-sm text-text-muted">
        Loading squad news…
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold">Squad news</h2>
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={refreshing || pinGate.loading}
          onClick={() => {
            pinGate.setError(null);
            void pinGate.request(refreshNews);
          }}
        >
          {refreshing || pinGate.loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Refresh
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-loss">{error}</p>}
      <div className="mt-4 space-y-4">
        {[data?.home, data?.away].filter(Boolean).map((team) => (
          <div key={team!.teamId} className="rounded-lg bg-surface-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">{team!.teamName}</p>
              <div className="flex items-baseline gap-2">
                {team!.impact != null && team!.impact.eloDelta !== 0 && (
                  <span
                    className={`num rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      team!.impact.eloDelta < 0 ? "bg-loss/10 text-loss" : "bg-win/10 text-win"
                    }`}
                    title={team!.impact.reasons.join("\n")}
                  >
                    news {team!.impact.eloDelta > 0 ? "+" : ""}
                    {team!.impact.eloDelta} Elo
                  </span>
                )}
                {team!.elo != null && (
                  <p className="num text-xs text-text-muted">Elo {Math.round(team!.elo)}</p>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-text-muted">
              {team!.summary ?? "No squad news synced yet — poller runs every 6h for upcoming matches."}
            </p>
            {team!.events.length > 0 && (
              <ul className="mt-3 space-y-2 text-xs">
                {team!.events.map((e, i) => (
                  <li key={`${e.type}-${i}`} className="text-text-muted">
                    <span className="font-semibold uppercase text-text">{e.type}</span>
                    {e.severity ? ` (${e.severity}${e.keyPlayer ? ", key player" : ""})` : ""}
                    {e.player ? ` · ${e.player}` : ""}
                    {e.detail ? ` — ${e.detail}` : ""}
                    {e.source && (
                      <>
                        {" "}
                        <a href={e.source} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                          source
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {team!.fetchedAt && (
              <p className="num mt-2 text-[10px] text-text-muted">
                Last fetched {team!.fetchedAt.slice(0, 16).replace("T", " ")} UTC
              </p>
            )}
          </div>
        ))}
      </div>
      <AdminPinDialog {...pinGate.dialogProps} />
    </Card>
  );
}
