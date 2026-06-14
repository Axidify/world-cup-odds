"use client";

import { useEffect, useState } from "react";
import { Flag } from "@/components/Flag";
import { Card } from "@/components/ui/Card";
import { useLiveScore } from "@/components/LiveScoresProvider";
import { getKickoffHighlight, kickoffHighlightCardClass } from "@/lib/match/kickoff-highlight";
import {
  formatLifecycleHint,
  formatLifecycleLabelLocal,
  getMatchLifecycle,
} from "@/lib/match/lifecycle";
import { formatLiveMinuteDisplay } from "@/lib/match/live-minute";
import { formatLocalDateTime, getLocalTimezoneName } from "@/lib/utils/dates";

type StatusResponse = {
  resultsPoll?: { intervalMinutes: number; nextPollAt: string; shouldPoll: boolean };
  liveScoresPoll?: { intervalSeconds: number };
};

type TeamSide = {
  name: string;
  flagCode: string;
  fifaRank?: number;
  elo?: number | null;
};

type Props = {
  matchId: string;
  kickoffIso: string;
  venue: string;
  stage: string;
  group?: string;
  home?: TeamSide;
  away?: TeamSide;
  confirmed?: {
    homeScore: number;
    awayScore: number;
    et?: boolean;
    pens?: boolean;
  } | null;
  livePollIntervalSeconds?: number;
};

function TeamColumn({
  team,
  align = "left",
}: {
  team: TeamSide;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 ${align === "right" ? "items-end text-right" : "items-start"}`}
    >
      <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <Flag code={team.flagCode} alt={team.name} size="lg" />
        <span className="truncate text-sm font-bold leading-tight sm:text-base">{team.name}</span>
      </div>
      {(team.fifaRank != null || team.elo != null) && (
        <p className="num text-[11px] text-text-muted">
          {team.fifaRank != null ? `FIFA #${team.fifaRank}` : ""}
          {team.fifaRank != null && team.elo != null ? " · " : ""}
          {team.elo != null ? `Elo ${Math.round(team.elo)}` : ""}
        </p>
      )}
    </div>
  );
}

export function MatchStatusCard({
  matchId,
  kickoffIso,
  venue,
  stage,
  group,
  home,
  away,
  confirmed,
  livePollIntervalSeconds: livePollIntervalSecondsProp = 60,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [poll, setPoll] = useState<StatusResponse["resultsPoll"] | null>(null);
  const [livePollIntervalSeconds, setLivePollIntervalSeconds] = useState(
    livePollIntervalSecondsProp,
  );
  const live = useLiveScore(matchId);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/tournament/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: StatusResponse | null) => {
          if (!active || !data) return;
          if (data.resultsPoll) setPoll(data.resultsPoll);
          if (data.liveScoresPoll?.intervalSeconds != null) {
            setLivePollIntervalSeconds(data.liveScoresPoll.intervalSeconds);
          }
        })
        .catch(() => {});
    void load();
    const id = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const isConfirmed = Boolean(confirmed);
  const lifecycle = getMatchLifecycle(kickoffIso, isConfirmed, now);
  const highlight = getKickoffHighlight(kickoffIso, lifecycle, now);
  const intervalMinutes = poll?.intervalMinutes ?? 15;
  const liveScore = live != null ? { home: live.homeScore, away: live.awayScore } : null;
  const minuteLabel = formatLiveMinuteDisplay(live, kickoffIso, now);

  const hasTeams = Boolean(home && away);
  const showScore =
    (lifecycle === "confirmed" && confirmed) || (lifecycle === "live" && live);
  const homeGoals = lifecycle === "confirmed" ? confirmed?.homeScore : live?.homeScore;
  const awayGoals = lifecycle === "confirmed" ? confirmed?.awayScore : live?.awayScore;

  const borderClass =
    lifecycle === "confirmed"
      ? "border-brand/50 bg-brand-tint/20"
      : lifecycle === "live"
        ? "border-loss/40 bg-loss/5"
        : lifecycle === "awaiting_result"
          ? "border-money/40 bg-money-tint/30"
          : kickoffHighlightCardClass(highlight) || "border-border bg-surface-2/50";

  const statusLabel =
    lifecycle === "confirmed"
      ? "Final"
      : lifecycle === "live"
        ? "Live"
        : formatLifecycleLabelLocal(lifecycle, kickoffIso, now, undefined, liveScore);

  const statusTone =
    lifecycle === "confirmed"
      ? "text-brand"
      : lifecycle === "live"
        ? "text-loss"
        : "text-text-muted";

  return (
    <Card className={`overflow-hidden p-4 sm:p-5 ${borderClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wider ${statusTone}`}>
          {statusLabel}
          {lifecycle === "live" && minuteLabel ? (
            <span className="ml-1.5 normal-case tracking-normal text-text">· {minuteLabel}</span>
          ) : null}
          {lifecycle === "confirmed" && confirmed?.et ? (
            <span className="ml-1.5 font-normal normal-case tracking-normal">· AET</span>
          ) : null}
          {lifecycle === "confirmed" && confirmed?.pens ? (
            <span className="ml-1.5 font-normal normal-case tracking-normal">· Pens</span>
          ) : null}
        </p>
        <p className="num text-[11px] font-semibold uppercase text-text-muted">
          {stage}
          {group ? ` · Gp ${group}` : ""}
        </p>
      </div>

      {hasTeams ? (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <TeamColumn team={home!} />
          <div className="flex flex-col items-center justify-center px-1">
            {showScore && homeGoals != null && awayGoals != null ? (
              <p className="num whitespace-nowrap text-2xl font-extrabold tracking-tight sm:text-3xl">
                {homeGoals}
                <span className="mx-1.5 text-text-muted">–</span>
                {awayGoals}
              </p>
            ) : (
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted">vs</p>
            )}
          </div>
          <TeamColumn team={away!} align="right" />
        </div>
      ) : null}

      <p
        className="mt-4 text-center text-xs leading-relaxed text-text-muted"
        suppressHydrationWarning
      >
        {formatLocalDateTime(kickoffIso)} ({getLocalTimezoneName()}) · {venue}
      </p>

      {lifecycle === "live" && live ? (
        <p className="mt-2 text-center text-[11px] text-text-muted">
          Updated {new Date(live.syncedAt).toLocaleTimeString()} · football-data.org live feed
        </p>
      ) : lifecycle !== "confirmed" ? (
        <p className="mt-2 text-center text-xs text-text-muted">
          {formatLifecycleHint(lifecycle, intervalMinutes, livePollIntervalSeconds)}
        </p>
      ) : null}

      {poll && lifecycle !== "upcoming" && lifecycle !== "confirmed" ? (
        <p className="num mt-3 hidden text-center text-[10px] text-text-muted md:block">
          Results poller{" "}
          {poll.shouldPoll
            ? `active · next check ${new Date(poll.nextPollAt).toLocaleTimeString()}`
            : `next window ${new Date(poll.nextPollAt).toLocaleTimeString()}`}
        </p>
      ) : null}
    </Card>
  );
}
