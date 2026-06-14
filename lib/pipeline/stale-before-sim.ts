import { getBulkJobState, isBulkJobRunning } from "@/lib/ai/bulk-job";
import { buildStaleAnalyzeQueue } from "@/lib/ai/preanalyze";
import { resolveAppBaseUrl, triggerBulkAnalyze } from "@/lib/ai/trigger-bulk-analyze";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { writePipelineState } from "@/lib/pipeline/pipeline-state";

const BULK_WAIT_MS = 3_600_000;
const BULK_POLL_MS = 2_000;
const MAX_STALE_PASSES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isBulkJobActiveRemote(): Promise<boolean> {
  try {
    const res = await fetch(`${resolveAppBaseUrl()}/api/analyze/bulk`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { active?: boolean; job?: { status?: string } };
    return Boolean(data.active) || data.job?.status === "running";
  } catch {
    return false;
  }
}

async function isAnyBulkJobActive(): Promise<boolean> {
  if (isBulkJobRunning() || getBulkJobState().status === "running") return true;
  return isBulkJobActiveRemote();
}

/** Wait for in-process or HTTP-triggered bulk analyze (poller + Next.js). */
export async function waitForBulkJobCompletion(timeoutMs = BULK_WAIT_MS): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await isAnyBulkJobActive())) return;
    await sleep(BULK_POLL_MS);
  }
  throw new Error("Timed out waiting for bulk analyze");
}

async function runStaleReanalyzePass(trigger: string): Promise<boolean> {
  const provider = resolveActiveProvider();
  if (!provider) return true;

  const queue = buildStaleAnalyzeQueue();
  if (queue.length === 0) return true;

  console.log(`[pipeline] Re-analyzing ${queue.length} stale prediction(s) before simulation`);

  if (await isAnyBulkJobActive()) {
    await waitForBulkJobCompletion();
    return buildStaleAnalyzeQueue().length === 0;
  }

  writePipelineState({
    status: "running",
    step: "analyze",
    trigger,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  });

  const job = await triggerBulkAnalyze({ refresh: true, stale: true });
  if (job === null) {
    if (await isAnyBulkJobActive()) {
      await waitForBulkJobCompletion();
    } else {
      return false;
    }
  } else {
    await waitForBulkJobCompletion();
  }

  const { failed, completed } = getBulkJobState();
  if (failed > 0 && completed === 0) return false;
  return true;
}

/**
 * Re-analyze actionable stale predictions before simulation.
 * Loops when new stale rows appear mid-run (e.g. another result confirms during bulk).
 */
export async function ensureStaleQueueClearedBeforeSim(trigger = "pre_sim"): Promise<boolean> {
  if (!resolveActiveProvider()) return true;

  for (let pass = 0; pass < MAX_STALE_PASSES; pass++) {
    if (buildStaleAnalyzeQueue().length === 0) return true;
    const passTrigger = pass === 0 ? trigger : `${trigger}_retry_${pass}`;
    const ok = await runStaleReanalyzePass(passTrigger);
    if (!ok) return false;
  }

  return buildStaleAnalyzeQueue().length === 0;
}
