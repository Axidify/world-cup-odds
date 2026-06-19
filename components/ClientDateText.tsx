"use client";

import { useEffect, useState } from "react";
import {
  formatLocalDate,
  formatLocalDateTime,
  formatLocalTime,
  formatUtcDate,
  formatUtcDateTime,
  getLocalTimezoneName,
} from "@/lib/utils/dates";

function utcDateTimeFallback(iso: string): string {
  return `${formatUtcDateTime(iso)} UTC`;
}

/** Local date/time label — SSR uses UTC, then switches to viewer timezone after mount. */
export function ClientLocalDateTime({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => utcDateTimeFallback(iso));
  useEffect(() => {
    setLabel(formatLocalDateTime(iso));
  }, [iso]);
  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}

export function ClientLocalDate({
  iso,
  className,
  options,
}: {
  iso: string;
  className?: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const [label, setLabel] = useState(() =>
    formatUtcDate(iso, options ?? { day: "numeric", month: "short" }),
  );
  useEffect(() => {
    setLabel(formatLocalDate(iso, options));
  }, [iso, options]);
  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}

/** `Date#toLocaleString()` — SSR uses UTC, then viewer locale after mount. */
export function ClientLocaleString({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => utcDateTimeFallback(iso));
  useEffect(() => {
    setLabel(new Date(iso).toLocaleString());
  }, [iso]);
  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}

export function ClientLocalTime({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => `${formatLocalTime(iso, "UTC")} UTC`);
  useEffect(() => {
    setLabel(new Date(iso).toLocaleTimeString());
  }, [iso]);
  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}

export function ClientTimezoneName({ className }: { className?: string }) {
  const [tz, setTz] = useState("UTC");
  useEffect(() => {
    setTz(getLocalTimezoneName());
  }, []);
  return (
    <span className={className} suppressHydrationWarning>
      {tz}
    </span>
  );
}
