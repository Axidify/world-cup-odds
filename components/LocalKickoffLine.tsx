"use client";

import { ClientLocalDateTime, ClientTimezoneName } from "@/components/ClientDateText";

type Props = {
  kickoffIso: string;
  venue: string;
  className?: string;
};

export function LocalKickoffLine({ kickoffIso, venue, className = "" }: Props) {
  return (
    <p className={className}>
      <ClientLocalDateTime iso={kickoffIso} /> (<ClientTimezoneName />) · {venue}
    </p>
  );
}
