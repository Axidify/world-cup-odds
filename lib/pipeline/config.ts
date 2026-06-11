function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes";
}

export type PipelineConfig = {
  enabled: boolean;
  simulateOnResults: boolean;
  analyzeMissing: boolean;
  onStart: boolean;
};

export function getPipelineConfig(): PipelineConfig {
  const enabled = envFlag("AUTO_PIPELINE_ENABLED", true);
  return {
    enabled,
    simulateOnResults: envFlag("AUTO_SIMULATE_ON_RESULTS", enabled),
    analyzeMissing: envFlag("AUTO_ANALYZE_MISSING", false),
    onStart: envFlag("AUTO_PIPELINE_ON_START", enabled),
  };
}
