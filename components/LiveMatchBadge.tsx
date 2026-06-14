"use client";

import { useEffect, useState } from "react";
import { MatchStatusBadge } from "@/components/MatchStatusBadge";
import { getMatchLifecycle } from "@/lib/match/lifecycle";

type Props = {
  matchId: string;
  kickoffIso: string;
};

/** Compact live / awaiting-sync badge — hidden before kickoff. */
export function LiveMatchBadge({ matchId, kickoffIso }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lifecycle = getMatchLifecycle(kickoffIso, false, now);
  if (lifecycle !== "live" && lifecycle !== "awaiting_result") return null;

  return <MatchStatusBadge matchId={matchId} kickoffIso={kickoffIso} compact />;
}
