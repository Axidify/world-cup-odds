"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatUtcDateTime } from "@/lib/utils/dates";

type StatusResponse = {
  matchActivity?: {
    liveCount: number;
    awaitingCount: number;
    matches: Array<{
      matchId: string;
      label: string;
      lifecycle: "live" | "awaiting_result";
      resultsCheckAt: string;
    }>;
  };
  resultsPoll?: {
    shouldPoll: boolean;
    nextPollAt: string;
    intervalMinutes: number;
  };
  poller?: { lastResultsPollAt: string | null };
};

export function ResultsSyncBanner() {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tournament/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const activity = status?.matchActivity;
  if (!activity || (activity.liveCount === 0 && activity.awaitingCount === 0)) {
    return null;
  }

  const poll = status?.resultsPoll;

  return (
    <Card className="border-border bg-surface-2/60 p-4" role="status">
      <div className="flex gap-3">
        <Radio size={18} className="mt-0.5 shrink-0 text-brand" />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-text">
            {activity.liveCount > 0 && (
              <span className="text-loss">
                {activity.liveCount} match{activity.liveCount === 1 ? "" : "es"} live
              </span>
            )}
            {activity.liveCount > 0 && activity.awaitingCount > 0 && " · "}
            {activity.awaitingCount > 0 && (
              <span className="text-money">
                {activity.awaitingCount} awaiting score sync
              </span>
            )}
          </p>
          {activity.matches.length > 0 && (
            <ul className="space-y-1 text-xs text-text-muted">
              {activity.matches.map((m) => (
                <li key={m.matchId}>
                  <a href={`/match/${m.matchId}`} className="font-semibold text-brand hover:underline">
                    {m.label}
                  </a>
                  {" — "}
                  {m.lifecycle === "live"
                    ? `live · score check ~${formatUtcDateTime(m.resultsCheckAt)} UTC`
                    : "searching for final score"}
                </li>
              ))}
            </ul>
          )}
          {poll && (
            <p className="text-xs text-text-muted">
              Poller {poll.shouldPoll ? "active" : "idle"} · checks every {poll.intervalMinutes} min
              when needed · next activity{" "}
              <span className="num">{new Date(poll.nextPollAt).toLocaleTimeString()}</span>
              {status?.poller?.lastResultsPollAt && (
                <>
                  {" "}
                  · last sync{" "}
                  <span className="num">
                    {new Date(status.poller.lastResultsPollAt).toLocaleTimeString()}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
