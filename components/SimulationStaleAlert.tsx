"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  hasSimulation: boolean;
  initialMessage?: string | null;
  className?: string;
};

export function SimulationStaleAlert({
  hasSimulation,
  initialMessage = null,
  className = "",
}: Props) {
  const [message, setMessage] = useState<string | null>(initialMessage);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tournament/status");
      if (!res.ok) return;
      const data = (await res.json()) as { staleMessage?: string | null };
      setMessage(data.staleMessage ?? null);
    } catch {
      // keep last known message
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [load]);

  if (!hasSimulation || !message) return null;

  return (
    <p className={`text-xs font-semibold text-loss ${className}`.trim()} role="status">
      {message}
    </p>
  );
}
