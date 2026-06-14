"use client";

import { useEffect, useState } from "react";
import { getKickoffHighlight } from "@/lib/match/kickoff-highlight";
import { getMatchLifecycle } from "@/lib/match/lifecycle";
import { formatUpcomingKickoffCompact } from "@/lib/utils/dates";

type Props = {
  kickoffIso: string;
  group?: string;
};

export function DashboardComingUpKickoff({ kickoffIso, group }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lifecycle = getMatchLifecycle(kickoffIso, false, now);
  const highlight = getKickoffHighlight(kickoffIso, lifecycle, now);
  const compactHighlight =
    highlight === "later_today" || highlight === "tomorrow" ? highlight : null;
  const label = formatUpcomingKickoffCompact(kickoffIso, compactHighlight);

  return (
    <span className="num text-xs text-text-muted" suppressHydrationWarning>
      {label}
      {group ? ` · Gp ${group}` : ""}
    </span>
  );
}
