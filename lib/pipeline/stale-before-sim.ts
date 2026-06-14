import { buildBulkAnalyzeQueue } from "@/lib/ai/preanalyze";
import {
  fetchBulkJobRemote,
  isBulkJobActive,
  triggerBulkAnalyze,
} from "@/lib/ai/trigger-bulk-analyze";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { writePipelineState } from "@/lib/pipeline/pipeline-state";

const BULK_WAIT_MS = 3_600_000;
const BULK_POLL_MS = 2_000;
const MAX_STALE_PASSES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait for bulk analyze on the Next.js worker (poller polls over HTTP). */
export async function waitForBulkJobCompletion(timeoutMs = BULK_WAIT_MS): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await isBulkJobActive())) return;
    await sleep(BULK_POLL_MS);
  }
  throw new Error("Timed out waiting for bulk analyze");
}

async function runStaleReanalyzePass(trigger: string): Promise<boolean> {
  const provider = resolveActiveProvider();
  if (!provider) return true;

  const queue = buildBulkAnalyzeQueue({ refresh: true, includeGaps: true });
  if (queue.length === 0) return true;

  console.log(`[pipeline] Re-analyzing ${queue.length} stale/outdated prediction(s) before simulation`);

  if (await isBulkJobActive()) {
    await waitForBulkJobCompletion();
    return buildBulkAnalyzeQueue({ refresh: true, includeGaps: true }).length === 0;
  }

  writePipelineState({
    status: "running",
    step: "analyze",
    trigger,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  });

  const job = await triggerBulkAnalyze({ refresh: true, stale: false });
  if (job === null) {
    if (await isBulkJobActive()) {
      await waitForBulkJobCompletion();
    } else {
      return false;
    }
  } else {
    await waitForBulkJobCompletion();
  }

  const { job: finalJob } = await fetchBulkJobRemote();
  if (finalJob.failed > 0 && finalJob.completed === 0) return false;
  return true;
}

/**
 * Re-analyze actionable stale predictions before simulation.
 * Loops when new stale rows appear mid-run (e.g. another result confirms during bulk).
 */
export async function ensureStaleQueueClearedBeforeSim(trigger = "pre_sim"): Promise<boolean> {
  if (!resolveActiveProvider()) return true;

  for (let pass = 0; pass < MAX_STALE_PASSES; pass++) {
    if (buildBulkAnalyzeQueue({ refresh: true, includeGaps: true }).length === 0) return true;
    const passTrigger = pass === 0 ? trigger : `${trigger}_retry_${pass}`;
    const ok = await runStaleReanalyzePass(passTrigger);
    if (!ok) return false;
  }

  return buildBulkAnalyzeQueue({ refresh: true, includeGaps: true }).length === 0;
}
