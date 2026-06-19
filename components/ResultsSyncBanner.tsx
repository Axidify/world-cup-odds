"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ClientLocalTime } from "@/components/ClientDateText";
import { formatLiveMinuteDisplay } from "@/lib/match/live-minute";
import { useLiveScores } from "@/components/LiveScoresProvider";

type StatusResponse = {
  matchActivity?: {
    liveCount: number;
    awaitingCount: number;
    matches: Array<{
      matchId: string;
      label: string;
      lifecycle: "live" | "awaiting_result";
      kickoff: string;
      resultsCheckAt: string;
    }>;
  };
  resultsPoll?: {
    shouldPoll: boolean;
    nextPollAt: string;
    intervalMinutes: number;
  };
  poller?: { lastResultsPollAt: string | null; lastLiveScoresPollAt: string | null };
};

export function ResultsSyncBanner() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const { scores } = useLiveScores();

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
                {activity.awaitingCount} awaiting final score sync
              </span>
            )}
          </p>
          {activity.matches.length > 0 && (
            <ul className="space-y-1 text-xs text-text-muted">
              {activity.matches.map((m) => {
                const live = scores[m.matchId];
                const minuteLabel = formatLiveMinuteDisplay(live, m.kickoff);
                return (
                  <li key={m.matchId}>
                    <a href={`/match/${m.matchId}`} className="font-semibold text-brand hover:underline">
                      {m.label}
                    </a>
                    {" — "}
                    {m.lifecycle === "live" && live
                      ? `live ${live.homeScore}–${live.awayScore}${minuteLabel ? ` (${minuteLabel})` : ""}`
                      : m.lifecycle === "live"
                        ? "live · waiting for score feed"
                        : "awaiting full-time confirm"}
                  </li>
                );
              })}
            </ul>
          )}
          {poll && (
            <p className="text-xs text-text-muted">
              Final scores: poller {poll.shouldPoll ? "active" : "idle"} every {poll.intervalMinutes} min
              {status?.poller?.lastLiveScoresPollAt && (
                <>
                  {" "}
                  · live feed <ClientLocalTime iso={status.poller.lastLiveScoresPollAt} />
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
