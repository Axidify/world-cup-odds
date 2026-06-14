import { getBulkJobState } from "@/lib/ai/bulk-job";
import { ownsBulkJobWorkers } from "@/lib/ai/bulk-job-owner";
import { getModelForProvider } from "@/lib/ai/config";
import {
  fetchBulkJobRemote,
  isBulkJobActive,
  triggerBulkAnalyze,
} from "@/lib/ai/trigger-bulk-analyze";
import { buildBulkAnalyzeQueue } from "@/lib/ai/preanalyze";
import { isProviderReady, resolveActiveProvider } from "@/lib/ai/settings";
import { seedMissingPairingsFromElo } from "@/lib/calibration/seed-elo-predictions";
import { getConfirmedResults } from "@/lib/sim/actual-results";
import { collectMissingPairings } from "@/lib/sim/gap-analysis";
import { loadPredictionStore } from "@/lib/sim/prediction-store";
import { runTournamentSimulation, TournamentSimulationError } from "@/lib/sim/run-tournament";
import { getSimulationStaleState, getLatestSimulation } from "@/lib/sim/simulation-cache";
import { tryAcquireTournamentLock, releaseTournamentLock } from "@/lib/sim/tournament-lock";
import { getPipelineConfig } from "@/lib/pipeline/config";
import { getPipelineState, writePipelineState, type PipelineState } from "@/lib/pipeline/pipeline-state";
import {
  ensureStaleQueueClearedBeforeSim,
  waitForBulkJobCompletion,
} from "@/lib/pipeline/stale-before-sim";

const DEBOUNCE_MS = 5_000;

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes";
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingTrigger: string | null = null;
let running: Promise<void> | null = null;

/** After restart, persisted pipeline state may still say running with no in-process worker. */
function reconcileOrphanedPipeline(graceMs = 120_000): void {
  const state = getPipelineState();
  if (state.status !== "running" && state.status !== "scheduled") return;
  if (running !== null || debounceTimer !== null) return;
  const started = state.startedAt ? Date.parse(state.startedAt) : 0;
  if (graceMs > 0 && started && Date.now() - started < graceMs) return;
  writePipelineState({
    status: "idle",
    trigger: null,
    step: null,
    finishedAt: new Date().toISOString(),
    error:
      state.status === "running"
        ? "Pipeline interrupted when the server restarted."
        : null,
  });
}

async function ensurePredictionsIfConfigured(): Promise<boolean> {
  const config = getPipelineConfig();
  if (!config.analyzeMissing) return false;

  const provider = resolveActiveProvider();
  if (!provider) return false;

  const queue = buildBulkAnalyzeQueue({ refresh: false, includeGaps: true });
  if (queue.length === 0) return true;

  if (await isBulkJobActive()) {
    await waitForBulkJobCompletion();
  }

  if (!(await isBulkJobActive())) {
    writePipelineState({
      status: "running",
      step: "analyze",
      trigger: "auto",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
    });
    await triggerBulkAnalyze({ refresh: false });
  }
  await waitForBulkJobCompletion();
  const failed = ownsBulkJobWorkers()
    ? getBulkJobState().failed
    : (await fetchBulkJobRemote()).job.failed;
  return failed === 0;
}

function ensureEloSeedForMissing(
  missing: ReturnType<typeof collectMissingPairings>,
): boolean {
  const config = getPipelineConfig();
  if (!config.eloSeedMissing || missing.length === 0) return false;

  const provider = resolveActiveProvider();
  if (!provider) return false;

  const model = getModelForProvider(provider);
  const seeded = seedMissingPairingsFromElo(missing, provider, model, {
    allowOverwrite: false,
  });
  if (seeded > 0) {
    console.log(`[pipeline] Elo-seeded ${seeded} missing prediction(s) from tournament Elo`);
  }
  return seeded > 0;
}

export async function runAutoSimulation(trigger: string): Promise<void> {
  const config = getPipelineConfig();
  if (!config.enabled) return;

  if (!isProviderReady()) {
    writePipelineState({
      status: "skipped",
      trigger,
      step: null,
      finishedAt: new Date().toISOString(),
      error: "No LLM provider configured",
    });
    return;
  }

  if (await isBulkJobActive()) {
    scheduleAutoSimulation(trigger);
    return;
  }

  if (!tryAcquireTournamentLock()) {
    scheduleAutoSimulation(trigger);
    return;
  }

  writePipelineState({
    status: "running",
    trigger,
    step: "simulate",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  });

  try {
    const provider = resolveActiveProvider()!;

    const staleCleared = await ensureStaleQueueClearedBeforeSim(trigger);
    if (!staleCleared) {
      writePipelineState({
        status: "skipped",
        trigger,
        step: null,
        finishedAt: new Date().toISOString(),
        error:
          "Stale predictions remain after re-analyze — check bulk analyze logs and retry simulation",
      });
      return;
    }

    const confirmed = getConfirmedResults();
    let store = loadPredictionStore(provider);
    let missing = collectMissingPairings(store, provider, confirmed);
    if (missing.length > 0) {
      await ensurePredictionsIfConfigured();
      store = loadPredictionStore(provider);
      missing = collectMissingPairings(store, provider, confirmed);
      if (missing.length > 0) {
        ensureEloSeedForMissing(missing);
      }
      store = loadPredictionStore(provider);
      const remaining = collectMissingPairings(store, provider, confirmed);
      if (remaining.length > 0) {
        writePipelineState({
          status: "skipped",
          trigger,
          step: null,
          finishedAt: new Date().toISOString(),
          error: `Missing ${remaining.length} prediction(s) — enable AUTO_ANALYZE_MISSING, ELO_SEED_MISSING, or analyze manually`,
        });
        return;
      }
    }

    runTournamentSimulation();
    writePipelineState({
      status: "completed",
      trigger,
      step: null,
      finishedAt: new Date().toISOString(),
      error: null,
    });
  } catch (err) {
    const msg =
      err instanceof TournamentSimulationError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Auto simulation failed";
    writePipelineState({
      status: "failed",
      trigger,
      step: null,
      finishedAt: new Date().toISOString(),
      error: msg,
    });
  } finally {
    releaseTournamentLock();
  }
}

export function scheduleAutoSimulation(trigger: string): void {
  const config = getPipelineConfig();
  if (!config.enabled || !config.simulateOnResults) return;
  scheduleAutoSimulationDebounced(trigger);
}

/** After dashboard bulk analyze — not gated on AUTO_SIMULATE_ON_RESULTS. */
export function scheduleAutoSimulationAfterBulkAnalyze(): void {
  const config = getPipelineConfig();
  if (!config.enabled) return;
  scheduleAutoSimulationDebounced("bulk_analyze");
}

function scheduleAutoSimulationDebounced(trigger: string): void {
  pendingTrigger = trigger;
  writePipelineState({ status: "scheduled", trigger, error: null });

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const t = pendingTrigger ?? trigger;
    pendingTrigger = null;
    void enqueuePipelineRun(t);
  }, DEBOUNCE_MS);
}

async function enqueuePipelineRun(trigger: string): Promise<void> {
  if (running) {
    running = running.then(() => enqueuePipelineRun(trigger));
    return;
  }
  running = runAutoSimulation(trigger).finally(() => {
    running = null;
  });
  await running;
}

/** Poller startup: analyze gaps (optional) and simulate if needed. */
export async function runStartupPipeline(): Promise<void> {
  const config = getPipelineConfig();
  if (!config.enabled || !config.onStart) return;

  const sim = getLatestSimulation();
  const stale = getSimulationStaleState();

  if (!config.analyzeMissing && config.eloSeedMissing) {
    const provider = resolveActiveProvider();
    if (provider) {
      const reseedPredictions = envFlag("ELO_RESEED_PREDICTIONS", false);
      if (reseedPredictions) {
        const { seedAllGroupFixturesFromElo } = await import(
          "@/lib/calibration/seed-elo-predictions"
        );
        const model = getModelForProvider(provider);
        const n = seedAllGroupFixturesFromElo(provider, model, { allowOverwrite: true });
        console.log(`[pipeline] Elo-reseeded ${n} group predictions (ELO_RESEED_PREDICTIONS)`);
      }
      const confirmed = getConfirmedResults();
      const store = loadPredictionStore(provider);
      const missing = collectMissingPairings(store, provider, confirmed);
      ensureEloSeedForMissing(missing);
    }
  }

  if (!sim || stale.stale) {
    await enqueuePipelineRun("startup");
  }
}

export function getReconciledPipelineState(): PipelineState {
  reconcileOrphanedPipeline();
  return getPipelineState();
}

export function isPipelineActive(): boolean {
  reconcileOrphanedPipeline();
  const state = getPipelineState();
  return state.status === "running" || state.status === "scheduled" || running !== null;
}

try {
  reconcileOrphanedPipeline(0);
} catch {
  // DB may not be ready during import in some build phases.
}
