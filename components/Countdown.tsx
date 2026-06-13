"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Flag } from "@/components/Flag";
import { formatUtcDateTime } from "@/lib/utils/dates";

export type CountdownMatch = {
  matchId: string;
  kickoffIso: string;
  homeName: string;
  awayName: string;
  homeFlagCode: string;
  awayFlagCode: string;
  group?: string | null;
  stage: string;
};

function remainingMs(targetISO: string): number {
  return Math.max(0, new Date(targetISO).getTime() - Date.now());
}

function parts(ms: number) {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return { days, hours, mins, secs };
}

const labels = ["Days", "Hours", "Mins", "Secs"] as const;

export function Countdown({ matches }: { matches: CountdownMatch[] }) {
  const router = useRouter();
  const refreshed = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [ms, setMs] = useState(0);

  const targetISO = matches[0]?.kickoffIso ?? "";

  useEffect(() => {
    if (!targetISO) return;
    setMounted(true);
    const tick = () => setMs(remainingMs(targetISO));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetISO]);

  useEffect(() => {
    if (!mounted || !targetISO) return;
    if (ms > 0) {
      refreshed.current = false;
      return;
    }
    if (!refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [mounted, ms, targetISO, router]);

  if (matches.length === 0) {
    return (
      <p className="text-sm text-text-muted">No upcoming fixtures with confirmed teams.</p>
    );
  }

  const { days, hours, mins, secs } = parts(ms);
  const values = mounted
    ? [days, hours, mins, secs].map((v) => String(v).padStart(2, "0"))
    : ["--", "--", "--", "--"];

  const simultaneous = matches.length > 1;

  return (
    <div suppressHydrationWarning>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {simultaneous ? "Next kickoffs" : "Next match"}
        <span className="num ml-2 font-normal normal-case">
          · {formatUtcDateTime(targetISO)} UTC
        </span>
      </p>

      <ul className={`mt-3 space-y-2 ${simultaneous ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
        {matches.map((m) => (
          <li key={m.matchId}>
            <Link
              href={`/match/${m.matchId}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2 text-sm transition-colors hover:border-brand/40 hover:bg-surface-2"
            >
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <Flag code={m.homeFlagCode} alt={m.homeName} size="sm" />
                <span className="truncate">{m.homeName}</span>
                <span className="text-text-muted">vs</span>
                <Flag code={m.awayFlagCode} alt={m.awayName} size="sm" />
                <span className="truncate">{m.awayName}</span>
              </span>
              <span className="num shrink-0 text-[10px] uppercase text-text-muted">
                {m.group ? `Gp ${m.group}` : m.stage}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap gap-4 sm:gap-6">
        {values.map((v, i) => (
          <div key={labels[i]} className="text-center">
            <div className="num font-[family-name:var(--font-archivo)] text-3xl font-extrabold sm:text-4xl">
              {v}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-text-muted">
              {labels[i]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
