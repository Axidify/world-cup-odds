"use client";

import { useCallback, useEffect, useState } from "react";
import type { LLMProvider } from "@/lib/types";

type ProviderRow = {
  id: LLMProvider;
  label: string;
  model: string;
  configured: boolean;
  online?: boolean;
};

type HealthResponse = {
  active: {
    provider: LLMProvider;
    label: string;
    model: string;
    online: boolean;
  } | null;
  providers: ProviderRow[];
};

export function ProviderStatus({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/health");
      if (res.ok) setData(await res.json());
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function switchProvider(provider: LLMProvider) {
    setSwitching(true);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) await load();
    } finally {
      setSwitching(false);
    }
  }

  const active = data?.active;
  const online = active?.online ?? false;
  const configured = Boolean(active);

  if (compact) {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold sm:flex">
        <span
          className={`h-2 w-2 rounded-full ${
            online
              ? "bg-win shadow-[0_0_0_3px_oklch(0.74_0.15_150/0.25)]"
              : configured
                ? "bg-loss"
                : "bg-text-muted"
          }`}
        />
        <span>{active?.label ?? "AI"}</span>
        <span className="num max-w-[120px] truncate text-text-muted">
          {active?.model ?? "not configured"}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">AI provider</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-win" : "bg-loss"}`} />
        <span className="font-semibold">{active?.label ?? "Not configured"}</span>
        <span className="num text-sm text-text-muted">
          {active?.model ?? "Add provider credentials to .env.local"}
        </span>
      </div>
      {data?.providers && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.providers
            .filter((p) => p.configured)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={switching || p.id === active?.provider}
                onClick={() => switchProvider(p.id)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                  p.id === active?.provider
                    ? "bg-brand-tint text-text ring-1 ring-brand"
                    : "bg-surface text-text-muted hover:text-text"
                }`}
              >
                {p.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
