function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes";
}

export type PipelineConfig = {
  enabled: boolean;
  simulateOnResults: boolean;
  analyzeMissing: boolean;
  /** Re-analyze stale LLM predictions before auto-sim (when LLM is available). */
  reanalyzeStale: boolean;
  /** Seed missing predictions from tournament Elo when LLM analyze is off. */
  eloSeedMissing: boolean;
  onStart: boolean;
};

export function getPipelineConfig(): PipelineConfig {
  const enabled = envFlag("AUTO_PIPELINE_ENABLED", true);
  return {
    enabled,
    simulateOnResults: envFlag("AUTO_SIMULATE_ON_RESULTS", enabled),
    analyzeMissing: envFlag("AUTO_ANALYZE_MISSING", false),
    reanalyzeStale: envFlag("AUTO_REANALYZE_STALE", false),
    eloSeedMissing: envFlag("ELO_SEED_MISSING", true),
    onStart: envFlag("AUTO_PIPELINE_ON_START", enabled),
  };
}
