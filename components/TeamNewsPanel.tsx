"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type TeamNewsBlock = {
  teamId: string;
  teamName: string;
  elo: number | null;
  summary: string | null;
  fetchedAt: string | null;
  events: Array<{
    type: string;
    player: string | null;
    detail: string | null;
    source: string | null;
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

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const body = (await res.json()) as { error?: string; outcomes?: Record<string, string> };
      if (!res.ok) {
        throw new Error(body.error ?? "Refresh failed");
      }
      if (body.outcomes && Object.values(body.outcomes).every((o) => o === "failed")) {
        throw new Error("News sync failed for both teams");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "News refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6 text-sm text-text-muted">
        Loading squad news…
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Squad news</h2>
        <Button variant="secondary" disabled={refreshing} onClick={() => void refresh()}>
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-loss">{error}</p>}
      <div className="mt-4 space-y-4">
        {[data?.home, data?.away].filter(Boolean).map((team) => (
          <div key={team!.teamId} className="rounded-lg bg-surface-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">{team!.teamName}</p>
              {team!.elo != null && (
                <p className="num text-xs text-text-muted">Elo {Math.round(team!.elo)}</p>
              )}
            </div>
            <p className="mt-2 text-sm text-text-muted">
              {team!.summary ?? "No squad news synced yet — poller runs every 6h for upcoming matches."}
            </p>
            {team!.events.length > 0 && (
              <ul className="mt-3 space-y-2 text-xs">
                {team!.events.map((e, i) => (
                  <li key={`${e.type}-${i}`} className="text-text-muted">
                    <span className="font-semibold uppercase text-text">{e.type}</span>
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
    </Card>
  );
}
