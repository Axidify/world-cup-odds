import type { BulkJobState } from "@/lib/ai/bulk-job";
import { isBulkJobRunning, startBulkAnalyze } from "@/lib/ai/bulk-job";

/** Normalize APP_URL — Railway sometimes omits the scheme. */
export function normalizeAppBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (
    trimmed.startsWith("localhost") ||
    trimmed.startsWith("127.0.0.1") ||
    trimmed.startsWith("[::1]")
  ) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

/** Base URL for the running Next.js app (poller must reach this). */
export function resolveAppBaseUrl(): string {
  const fromEnv = process.env.APP_URL?.trim();
  if (fromEnv) return normalizeAppBaseUrl(fromEnv);
  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}`;
}

/**
 * Start bulk analyze in the Next.js process.
 * Poller and other workers must use HTTP so in-memory job state stays in one place.
 */
export async function triggerBulkAnalyze(
  options: { refresh?: boolean; stale?: boolean } = {},
): Promise<BulkJobState | null> {
  if (isBulkJobRunning()) return null;

  const base = resolveAppBaseUrl();
  const pin = process.env.ADMIN_PIN?.trim();
  const res = await fetch(`${base}/api/analyze/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh: options.refresh ?? false,
      stale: options.stale ?? false,
      pin,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429) return null;

  const body = (await res.json().catch(() => ({}))) as { job?: BulkJobState; error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Bulk analyze request failed (${res.status})`);
  }

  return body.job ?? null;
}

/** Start bulk analyze in-process — only for the Next.js `/api/analyze/bulk` route. */
export async function triggerBulkAnalyzeInProcess(
  options: { refresh?: boolean } = {},
): Promise<BulkJobState> {
  return startBulkAnalyze(options);
}
