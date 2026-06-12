"use client";

import { formatLocalDateTime, getLocalTimezoneName } from "@/lib/utils/dates";

type Props = {
  kickoffIso: string;
  venue: string;
  className?: string;
};

export function LocalKickoffLine({ kickoffIso, venue, className = "" }: Props) {
  return (
    <p className={className} suppressHydrationWarning>
      {formatLocalDateTime(kickoffIso)} ({getLocalTimezoneName()}) · {venue}
    </p>
  );
}
