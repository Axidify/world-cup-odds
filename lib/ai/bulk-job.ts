import { eq } from "drizzle-orm";
import { analyzeMatch } from "@/lib/ai/analyze-match";
import { analyzePair } from "@/lib/ai/analyze-pair";
import { getModelForProvider } from "@/lib/ai/config";
import { buildBulkAnalyzeQueue, type BulkWorkItem } from "@/lib/ai/preanalyze";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { getDb } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { getLlmConcurrency, runPool } from "@/lib/utils/concurrency";

export type BulkJobStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

export type BulkJobState = {
  status: BulkJobStatus;
  total: number;
  completed: number;
  skipped: number;
  failed: number;
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
    status: "failed",
    current: null,
    finishedAt: new Date().toISOString(),
    error: "Job interrupted (server restarted)",
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
  if (runningPromise) return true;
  return readState().status === "running";
}

export async function startBulkAnalyze(options: { refresh?: boolean } = {}): Promise<BulkJobState> {
  if (runningPromise) {
    await runningPromise.catch(() => {});
  }

  const current = readState();
  if (current.status === "running") {
    throw new Error("Bulk analyze is already running");
  }

  const provider = resolveActiveProvider();
  if (!provider) {
    throw new Error("No LLM provider is configured");
  }

  const queue = buildBulkAnalyzeQueue({ refresh: options.refresh ?? false, includeGaps: false });

  const initial: BulkJobState = {
    status: "running",
    total: queue.length,
    completed: 0,
    skipped: 0,
    failed: 0,
    current: queue[0]?.label ?? null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    provider,
    model: getModelForProvider(provider),
    refresh: options.refresh ?? false,
  };
  writeState(initial);

  const myRunId = ++runId;
  cancelRequested = false;
  runningPromise = runBulkQueue(queue, initial, myRunId).finally(() => {
    runningPromise = null;
  });
  void runningPromise;

  return initial;
}

export function cancelBulkAnalyze(): BulkJobState {
  cancelRequested = true;
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
  let completed = 0;
  let failed = 0;

  const isActive = () => !cancelRequested && myRunId === runId;

  const update = (patch: Partial<BulkJobState>) => {
    if (!isActive()) return;
    writeState({ ...readStateRaw(), ...patch });
  };

  const processItem = async (item: BulkWorkItem) => {
    if (!isActive()) return;
    try {
      if (item.kind === "match") {
        await analyzeMatch(item.matchId, { refresh: state.refresh });
      } else {
        await analyzePair(item.homeTeamId, item.awayTeamId, item.stage, {
          refresh: state.refresh,
        });
      }
      if (!isActive()) return;
      completed += 1;
    } catch {
      if (!isActive()) return;
      failed += 1;
    }
    update({ completed, failed, skipped: 0 });
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

    if (!isActive()) return;

    const gapQueue = buildBulkAnalyzeQueue({ refresh: state.refresh, includeGaps: true }).filter(
      (item) => !queue.some((q) => q.label === item.label),
    );

    if (gapQueue.length > 0 && isActive()) {
      update({ total: state.total + gapQueue.length });
      await runPool(
        gapQueue,
        concurrency,
        async (item) => {
          if (!isActive()) return;
          update({ current: `Gap: ${item.label}` });
          await processItem(item);
        },
        () => !isActive(),
      );
    }

    if (!isActive()) return;

    writeState({
      ...readStateRaw(),
      status: failed > 0 && completed === 0 ? "failed" : "completed",
      completed,
      failed,
      current: null,
      finishedAt: new Date().toISOString(),
      error: failed > 0 ? `${failed} item(s) failed` : null,
    });
  } catch (err) {
    if (isActive()) {
      writeState({
        ...readStateRaw(),
        status: "failed",
        current: null,
        finishedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Bulk analyze failed",
      });
    }
  }
}
