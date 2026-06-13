import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPipelineConfig } from "@/lib/pipeline/config";
import { getPipelineState, writePipelineState } from "@/lib/pipeline/pipeline-state";
import {
  scheduleAutoSimulation,
  scheduleAutoSimulationAfterBulkAnalyze,
} from "@/lib/pipeline/auto-pipeline";

describe("auto-pipeline", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.AUTO_PIPELINE_ENABLED = "0";
    writePipelineState({
      status: "idle",
      trigger: null,
      step: null,
      startedAt: null,
      finishedAt: null,
      error: null,
    });
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("parses pipeline config flags", () => {
    process.env.AUTO_PIPELINE_ENABLED = "1";
    process.env.AUTO_SIMULATE_ON_RESULTS = "0";
    process.env.AUTO_ANALYZE_MISSING = "true";
    const config = getPipelineConfig();
    expect(config.enabled).toBe(true);
    expect(config.simulateOnResults).toBe(false);
    expect(config.analyzeMissing).toBe(true);
    expect(config.eloSeedMissing).toBe(true);
  });

  it("does not schedule when pipeline is disabled", () => {
    process.env.AUTO_PIPELINE_ENABLED = "0";
    scheduleAutoSimulation("test");
    expect(getPipelineState().status).toBe("idle");
  });

  it("marks scheduled when auto simulate is enabled", () => {
    process.env.AUTO_PIPELINE_ENABLED = "1";
    process.env.AUTO_SIMULATE_ON_RESULTS = "1";
    scheduleAutoSimulation("test");
    expect(getPipelineState().status).toBe("scheduled");
    expect(getPipelineState().trigger).toBe("test");
  });

  it("schedules after bulk analyze even when simulate-on-results is off", () => {
    process.env.AUTO_PIPELINE_ENABLED = "1";
    process.env.AUTO_SIMULATE_ON_RESULTS = "0";
    scheduleAutoSimulationAfterBulkAnalyze();
    expect(getPipelineState().status).toBe("scheduled");
    expect(getPipelineState().trigger).toBe("bulk_analyze");
  });
});
