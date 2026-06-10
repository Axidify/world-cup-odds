"use client";

import { useEffect, useState } from "react";

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

export function Countdown({ targetISO }: { targetISO: string }) {
  const [mounted, setMounted] = useState(false);
  const [ms, setMs] = useState(0);

  useEffect(() => {
    setMounted(true);
    const tick = () => setMs(remainingMs(targetISO));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetISO]);

  const { days, hours, mins, secs } = parts(ms);
  const values = mounted
    ? [days, hours, mins, secs].map((v) => String(v).padStart(2, "0"))
    : ["--", "--", "--", "--"];

  return (
    <div className="flex flex-wrap gap-4 sm:gap-6" suppressHydrationWarning>
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
  );
}
