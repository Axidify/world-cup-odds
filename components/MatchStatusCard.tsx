"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  formatLifecycleHint,
  formatLifecycleLabel,
  getMatchLifecycle,
} from "@/lib/match/lifecycle";
import { formatUtcDateTime } from "@/lib/utils/dates";

type StatusResponse = {
  resultsPoll?: { intervalMinutes: number; nextPollAt: string; shouldPoll: boolean };
};

type Props = {
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

export function MatchStatusCard({ kickoffIso, venue, confirmed, homeName, awayName }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [poll, setPoll] = useState<StatusResponse["resultsPoll"] | null>(null);

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
  const intervalMinutes = poll?.intervalMinutes ?? 15;

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

  const borderClass =
    lifecycle === "live"
      ? "border-loss/40 bg-loss/5"
      : lifecycle === "awaiting_result"
        ? "border-money/40 bg-money-tint/30"
        : "border-border bg-surface-2/50";

  return (
    <Card className={`p-4 ${borderClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Match status</p>
        <p className={`text-sm font-semibold ${lifecycle === "live" ? "text-loss" : "text-text"}`}>
          {formatLifecycleLabel(lifecycle, kickoffIso, now)}
        </p>
      </div>
      <p className="mt-2 text-sm text-text-muted">{formatLifecycleHint(lifecycle, intervalMinutes)}</p>
      <dl className="mt-3 space-y-1 text-xs text-text-muted">
        <div className="flex justify-between gap-4">
          <dt>Kickoff</dt>
          <dd className="num text-text">{formatUtcDateTime(kickoffIso)} UTC</dd>
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
