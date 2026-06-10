import type { LLMProvider } from "@/lib/types";

export type LLMConfig = {
  provider: LLMProvider;
  model: string;
};

export type LLMClient = {
  readonly config: LLMConfig;
  completeJSON(system: string, user: string): Promise<string>;
  healthCheck(): Promise<boolean>;
};

export type ProviderInfo = {
  id: LLMProvider;
  label: string;
  model: string;
  configured: boolean;
  online?: boolean;
};

export type RawMatchPrediction = {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  predictedScore: string;
  keyFactors: string[];
  analysis: string;
};
