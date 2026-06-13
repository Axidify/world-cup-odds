import { eq } from "drizzle-orm";
import { analyzeMatch } from "@/lib/ai/analyze-match";
import { analyzePair } from "@/lib/ai/analyze-pair";
import { getModelForProvider } from "@/lib/ai/config";
import { buildBulkAnalyzeQueue, countBulkTargets, invalidateBulkTargetsCache, type BulkWorkItem } from "@/lib/ai/preanalyze";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { getDb } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { getLlmConcurrency, runPool } from "@/lib/utils/concurrency";
import { logBulkLlmSummary, type BulkLlmSummary } from "@/lib/ai/llm-log";

export type BulkJobStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

export type BulkJobState = {
  status: BulkJobStatus;
  total: number;
  completed: number;
  skipped: number;
  failed: number;
  /** Baseline catalog size (group + top-24 pairings) for overall progress context. */
  catalogTotal: number;
  /** Core pairings already cached when this run started. */
  cachedAtStart: number;
  current: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  provider: string | null;
  model: string | null;
  refresh: boolean;
};

const SETTINGS_KEY = "bulk_job";

const IDLE: BulkJobState = {
  status: "idle",
  total: 0,
  completed: 0,
  skipped: 0,
  failed: 0,
  catalogTotal: 0,
  cachedAtStart: 0,
  current: null,
  startedAt: null,
  finishedAt: null,
  error: null,
  provider: null,
  model: null,
  refresh: false,
};

let cancelRequested = false;
let runningPromise: Promise<void> | null = null;
let runId = 0;

/** After dev hot-reload or process restart, DB may still say "running" with no workers. */
function reconcileOrphanedJob(): void {
  const state = readStateRaw();
  if (state.status !== "running" || runningPromise) return;
  writeState({
    ...state,
    status: "cancelled",
    current: null,
    finishedAt: new Date().toISOString(),
    error:
      "Bulk analyze stopped when the dev server restarted. Click Analyze all to continue — cached matches are skipped.",
  });
}

function readStateRaw(): BulkJobState {
  try {
    const db = getDb();
    const row = db.select().from(appSettings).where(eq(appSettings.key, SETTINGS_KEY)).get();
    if (!row?.value) return { ...IDLE };
    return { ...IDLE, ...JSON.parse(row.value) } as BulkJobState;
  } catch {
    return { ...IDLE };
  }
}

function writeState(state: BulkJobState): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.insert(appSettings)
    .values({ key: SETTINGS_KEY, value: JSON.stringify(state), updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: JSON.stringify(state), updatedAt: now },
    })
    .run();
}

function readState(): BulkJobState {
  reconcileOrphanedJob();
  return readStateRaw();
}

export function getBulkJobState(): BulkJobState {
  return readState();
}

export function isBulkJobRunning(): boolean {
  reconcileOrphanedJob();
  return readStateRaw().status === "running";
}

/** Clear persisted bulk job UI state (e.g. after switching LLM provider). */
export function resetBulkJobState(): BulkJobState {
  cancelRequested = true;
  runId += 1;
  runningPromise = null;
  writeState({ ...IDLE });
  return { ...IDLE };
}

export async function startBulkAnalyze(options: { refresh?: boolean } = {}): Promise<BulkJobState> {
  if (runningPromise) {
    await Promise.resolve(runningPromise).catch(() => {});
  }

  const current = readState();
  if (current.status === "running") {
    throw new Error("Bulk analyze is already running");
  }

  const provider = resolveActiveProvider();
  if (!provider) {
    throw new Error("No LLM provider is configured");
  }

  const refresh = options.refresh ?? false;
  const queue = buildBulkAnalyzeQueue({ refresh, includeGaps: true });
  return startBulkAnalyzeWithQueue(queue, { refresh });
}

/** Write running state and return it — does not start workers. */
export function prepareBulkAnalyzeWithQueue(
  queue: BulkWorkItem[],
  options: { refresh?: boolean } = {},
): BulkJobState {
  const provider = resolveActiveProvider();
  if (!provider) {
    throw new Error("No LLM provider is configured");
  }

  const refresh = options.refresh ?? false;
  const targets = countBulkTargets(refresh);

  if (queue.length === 0) {
    const done: BulkJobState = {
      status: "completed",
      total: 0,
      completed: 0,
      skipped: targets.cached,
      failed: 0,
      catalogTotal: targets.total,
      cachedAtStart: targets.cached,
      current: null,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      error: null,
      provider,
      model: getModelForProvider(provider),
      refresh,
    };
    writeState(done);
    return done;
  }

  const initial: BulkJobState = {
    status: "running",
    total: queue.length,
    completed: 0,
    skipped: 0,
    failed: 0,
    catalogTotal: targets.total,
    cachedAtStart: targets.cached,
    current: queue[0]?.label ?? null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    provider,
    model: getModelForProvider(provider),
    refresh,
  };
  writeState(initial);
  return initial;
}

/** Start workers for a prepared bulk job (safe to call from next/server `after`). */
export function launchBulkAnalyzeInBackground(
  queue: BulkWorkItem[],
  initial: BulkJobState,
): void {
  if (initial.status !== "running") return;

  const myRunId = ++runId;
  cancelRequested = false;
  runningPromise = runBulkQueue(queue, initial, myRunId)
    .catch((err) => {
      console.error("[bulk] background run failed:", err);
    })
    .finally(() => {
      runningPromise = null;
      invalidateBulkTargetsCache();
    });
}

/** Run a pre-built queue (e.g. stale re-analyze) in-process. */
export async function startBulkAnalyzeWithQueue(
  queue: BulkWorkItem[],
  options: { refresh?: boolean } = {},
): Promise<BulkJobState> {
  if (runningPromise) {
    await Promise.resolve(runningPromise).catch(() => {});
  }

  const current = readState();
  if (current.status === "running") {
    throw new Error("Bulk analyze is already running");
  }

  const initial = prepareBulkAnalyzeWithQueue(queue, options);
  if (initial.status === "running") {
    launchBulkAnalyzeInBackground(queue, initial);
  }
  return initial;
}

export function cancelBulkAnalyze(): BulkJobState {
  cancelRequested = true;
  runId += 1;
  const state = readStateRaw();
  if (state.status === "running") {
    writeState({
      ...state,
      status: "cancelled",
      finishedAt: new Date().toISOString(),
      current: null,
    });
  }
  return readState();
}

async function runBulkQueue(
  queue: BulkWorkItem[],
  state: BulkJobState,
  myRunId: number,
): Promise<void> {
  const concurrency = getLlmConcurrency();
  const bulkStarted = Date.now();
  let completed = 0;
  let failed = 0;
  let lastError: string | null = null;

  const isActive = () => !cancelRequested && myRunId === runId;

  const update = (patch: Partial<BulkJobState>) => {
    if (!isActive()) return;
    writeState({ ...readStateRaw(), ...patch });
  };

  const runItem = async (item: BulkWorkItem) => {
    if (item.kind === "match") {
      await analyzeMatch(item.matchId, { refresh: state.refresh });
    } else {
      await analyzePair(item.homeTeamId, item.awayTeamId, item.stage, {
        refresh: state.refresh,
      });
    }
  };

  const processItem = async (item: BulkWorkItem) => {
    if (!isActive()) return;
    try {
      await runItem(item);
      completed += 1;
    } catch (err) {
      failed += 1;
      lastError = err instanceof Error ? err.message : "Analyze failed";
    }
    update({ completed, failed, skipped: 0 });
  };

  const emitSummary = (status: BulkLlmSummary["status"]) => {
    logBulkLlmSummary({
      status,
      provider: state.provider,
      model: state.model,
      analyzed: completed,
      failed,
      total: readStateRaw().total,
      durationMs: Date.now() - bulkStarted,
    });
  };

  try {
    await runPool(
      queue,
      concurrency,
      async (item) => {
        if (!isActive()) return;
        update({ current: item.label });
        await processItem(item);
      },
      () => !isActive(),
    );

    if (!isActive()) {
      emitSummary("cancelled");
      return;
    }

    const total = readStateRaw().total;
    const finalStatus = failed > 0 && completed === 0 ? "failed" : "completed";
    writeState({
      ...readStateRaw(),
      status: finalStatus,
      completed,
      failed,
      current: null,
      finishedAt: new Date().toISOString(),
      error:
        failed > 0
          ? completed > 0
            ? `${completed}/${total} analyzed · ${failed} failed${lastError ? ` (e.g. ${lastError})` : ""}`
            : `${failed} item(s) failed${lastError ? `: ${lastError}` : ""}`
          : null,
    });

    emitSummary(finalStatus);

    invalidateBulkTargetsCache();

    if (completed > 0) {
      void import("@/lib/pipeline/auto-pipeline").then(({ scheduleAutoSimulationAfterBulkAnalyze }) => {
        scheduleAutoSimulationAfterBulkAnalyze();
      });
    }
  } catch (err) {
    if (isActive()) {
      writeState({
        ...readStateRaw(),
        status: "failed",
        current: null,
        finishedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Bulk analyze failed",
      });
      emitSummary("failed");
    } else {
      emitSummary("cancelled");
    }
  }
}
