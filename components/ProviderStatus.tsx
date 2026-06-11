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

function ProviderSwitcher({
  data,
  active,
  switching,
  onSwitch,
  className = "",
}: {
  data: HealthResponse | null;
  active: HealthResponse["active"];
  switching: boolean;
  onSwitch: (provider: LLMProvider) => void;
  className?: string;
}) {
  if (!data?.providers) return null;
  const configured = data.providers.filter((p) => p.configured);
  if (configured.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {configured.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={switching || p.id === active?.provider}
          onClick={() => onSwitch(p.id)}
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
  );
}

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
    if (provider === active?.provider) return;
    const target = data?.providers.find((p) => p.id === provider);
    const ok = window.confirm(
      `Switch to ${target?.label ?? provider}?\n\nCached predictions were made with a different model. You'll need to re-analyze matches and re-run simulation before odds are trustworthy again.`,
    );
    if (!ok) return;

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

  const active = data?.active ?? null;
  const online = active?.online ?? false;
  const configured = Boolean(active);

  if (compact) {
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
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
        <ProviderSwitcher
          data={data}
          active={active}
          switching={switching}
          onSwitch={switchProvider}
          className="hidden lg:flex"
        />
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
      <ProviderSwitcher
        data={data}
        active={active}
        switching={switching}
        onSwitch={switchProvider}
        className="mt-3"
      />
    </div>
  );
}
