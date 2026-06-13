import { getBulkJobState, isBulkJobRunning } from "@/lib/ai/bulk-job";
import { getModelForProvider } from "@/lib/ai/config";
import { triggerBulkAnalyze } from "@/lib/ai/trigger-bulk-analyze";
import { buildBulkAnalyzeQueue } from "@/lib/ai/preanalyze";
import { isProviderReady, resolveActiveProvider } from "@/lib/ai/settings";
import { seedMissingPairingsFromElo } from "@/lib/calibration/seed-elo-predictions";
import { collectMissingPairings } from "@/lib/sim/gap-analysis";
import { loadPredictionStore } from "@/lib/sim/prediction-store";
import { runTournamentSimulation, TournamentSimulationError } from "@/lib/sim/run-tournament";
import { getSimulationStaleState, getLatestSimulation } from "@/lib/sim/simulation-cache";
import { tryAcquireTournamentLock, releaseTournamentLock } from "@/lib/sim/tournament-lock";
import { getPipelineConfig } from "@/lib/pipeline/config";
import { getPipelineState, writePipelineState } from "@/lib/pipeline/pipeline-state";

const DEBOUNCE_MS = 5_000;

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes";
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingTrigger: string | null = null;
let running: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBulkJob(timeoutMs = 3_600_000): Promise<void> {
  const started = Date.now();
  while (isBulkJobRunning() || getBulkJobState().status === "running") {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for bulk analyze");
    }
    await sleep(2_000);
  }
}

async function ensurePredictionsIfConfigured(): Promise<boolean> {
  const config = getPipelineConfig();
  if (!config.analyzeMissing) return false;

  const provider = resolveActiveProvider();
  if (!provider) return false;

  const queue = buildBulkAnalyzeQueue({ refresh: false, includeGaps: true });
  if (queue.length === 0) return true;

  if (!isBulkJobRunning()) {
    writePipelineState({ status: "running", step: "analyze", trigger: "auto" });
    await triggerBulkAnalyze({ refresh: false });
  }
  await waitForBulkJob();
  return getBulkJobState().failed === 0;
}

function ensureEloSeedForMissing(
  missing: ReturnType<typeof collectMissingPairings>,
): boolean {
  const config = getPipelineConfig();
  if (!config.eloSeedMissing || missing.length === 0) return false;

  const provider = resolveActiveProvider();
  if (!provider) return false;

  const model = getModelForProvider(provider);
  const seeded = seedMissingPairingsFromElo(missing, provider, model);
  console.log(`[pipeline] Elo-seeded ${seeded} missing prediction(s) from eloratings.net`);
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

  if (isBulkJobRunning()) {
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
    error: null,
  });

  try {
    const provider = resolveActiveProvider()!;
    const store = loadPredictionStore(provider);
    const missing = collectMissingPairings(store, provider);
    if (missing.length > 0) {
      const analyzed = await ensurePredictionsIfConfigured();
      const stillMissing = analyzed ? [] : collectMissingPairings(store, provider);
      if (stillMissing.length > 0) {
        ensureEloSeedForMissing(stillMissing);
      }
      const remaining = collectMissingPairings(loadPredictionStore(provider), provider);
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

  if (config.analyzeMissing) {
    await ensurePredictionsIfConfigured();
  } else if (config.eloSeedMissing) {
    const provider = resolveActiveProvider();
    if (provider) {
      const reseedPredictions = envFlag("ELO_RESEED_PREDICTIONS", false);
      if (reseedPredictions) {
        const { seedAllGroupFixturesFromElo } = await import(
          "@/lib/calibration/seed-elo-predictions"
        );
        const model = getModelForProvider(provider);
        const n = seedAllGroupFixturesFromElo(provider, model);
        console.log(`[pipeline] Elo-reseeded ${n} group predictions (ELO_RESEED_PREDICTIONS)`);
      }
      const store = loadPredictionStore(provider);
      const missing = collectMissingPairings(store, provider);
      ensureEloSeedForMissing(missing);
    }
  }

  if (!sim || stale.stale) {
    await enqueuePipelineRun("startup");
  }
}

export function isPipelineActive(): boolean {
  const state = getPipelineState();
  return state.status === "running" || state.status === "scheduled" || running !== null;
}
