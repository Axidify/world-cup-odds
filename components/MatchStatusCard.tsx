"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useLiveScore } from "@/components/LiveScoresProvider";
import { getKickoffHighlight, kickoffHighlightCardClass } from "@/lib/match/kickoff-highlight";
import {
  formatLifecycleHint,
  formatLifecycleLabelLocal,
  getMatchLifecycle,
} from "@/lib/match/lifecycle";
import { formatLocalDateTime, getLocalTimezoneName } from "@/lib/utils/dates";

type StatusResponse = {
  resultsPoll?: { intervalMinutes: number; nextPollAt: string; shouldPoll: boolean };
};

type Props = {
  matchId: string;
  kickoffIso: string;
  venue: string;
  confirmed?: {
    homeScore: number;
    awayScore: number;
    et?: boolean;
    pens?: boolean;
  } | null;
  homeName?: string;
  awayName?: string;
};

export function MatchStatusCard({
  matchId,
  kickoffIso,
  venue,
  confirmed,
  homeName,
  awayName,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [poll, setPoll] = useState<StatusResponse["resultsPoll"] | null>(null);
  const live = useLiveScore(matchId);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/tournament/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.resultsPoll) setPoll(data.resultsPoll);
      })
      .catch(() => {});
    const id = setInterval(() => {
      fetch("/api/tournament/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (active && data?.resultsPoll) setPoll(data.resultsPoll);
        })
        .catch(() => {});
    }, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const isConfirmed = Boolean(confirmed);
  const lifecycle = getMatchLifecycle(kickoffIso, isConfirmed, now);
  const highlight = getKickoffHighlight(kickoffIso, lifecycle, now);
  const intervalMinutes = poll?.intervalMinutes ?? 15;
  const liveScore =
    live != null ? { home: live.homeScore, away: live.awayScore } : null;

  if (lifecycle === "confirmed" && confirmed && homeName && awayName) {
    return (
      <Card className="border-brand/50 bg-brand-tint/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Final result</p>
        <p className="mt-1 text-lg font-bold">
          {homeName} {confirmed.homeScore}–{confirmed.awayScore} {awayName}
          {confirmed.et ? " (aet)" : ""}
          {confirmed.pens ? " (pens)" : ""}
        </p>
      </Card>
    );
  }

  if (lifecycle === "live" && live && homeName && awayName) {
    return (
      <Card className="border-loss/40 bg-loss/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-loss">Live</p>
        <p className="mt-1 text-lg font-bold">
          {homeName} {live.homeScore}–{live.awayScore} {awayName}
          {live.minute ? (
            <span className="ml-2 text-sm font-semibold text-text-muted">{live.minute}</span>
          ) : null}
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Updated {new Date(live.syncedAt).toLocaleTimeString()} · Big Balls live feed
        </p>
      </Card>
    );
  }

  const borderClass =
    lifecycle === "live"
      ? "border-loss/40 bg-loss/5"
      : lifecycle === "awaiting_result"
        ? "border-money/40 bg-money-tint/30"
        : kickoffHighlightCardClass(highlight) || "border-border bg-surface-2/50";

  return (
    <Card className={`p-4 ${borderClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Match status</p>
        <p className={`text-sm font-semibold ${lifecycle === "live" ? "text-loss" : "text-text"}`}>
          {formatLifecycleLabelLocal(lifecycle, kickoffIso, now, undefined, liveScore)}
        </p>
      </div>
      <p className="mt-2 text-sm text-text-muted">{formatLifecycleHint(lifecycle, intervalMinutes)}</p>
      <dl className="mt-3 space-y-1 text-xs text-text-muted">
        <div className="flex justify-between gap-4">
          <dt>Kickoff</dt>
          <dd className="num text-text" suppressHydrationWarning>
            {formatLocalDateTime(kickoffIso)} ({getLocalTimezoneName()})
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Venue</dt>
          <dd className="text-right text-text">{venue}</dd>
        </div>
        {poll && lifecycle !== "upcoming" && (
          <div className="flex justify-between gap-4">
            <dt>Results poller</dt>
            <dd className="num text-right text-text">
              {poll.shouldPoll
                ? `active · next check ${new Date(poll.nextPollAt).toLocaleTimeString()}`
                : `next window ${new Date(poll.nextPollAt).toLocaleTimeString()}`}
            </dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
