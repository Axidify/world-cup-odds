import type { LLMProvider } from "@/lib/types";
import type { ProviderInfo } from "./types";

export const ALL_PROVIDERS: LLMProvider[] = [
  "vllm",
  "openai",
  "openrouter",
  "gemini",
  "anthropic",
];

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  vllm: "vLLM",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  gemini: "Gemini",
  anthropic: "Anthropic",
};

export function getEnvProvider(): LLMProvider {
  const p = (process.env.LLM_PROVIDER ?? "vllm").toLowerCase();
  if (ALL_PROVIDERS.includes(p as LLMProvider)) {
    return p as LLMProvider;
  }
  return "vllm";
}

export function getModelForProvider(provider: LLMProvider): string {
  switch (provider) {
    case "vllm":
      return process.env.VLLM_MODEL ?? "Qwen3.6-35B-A3B-FP8";
    case "openai":
      return process.env.OPENAI_MODEL ?? "gpt-4o";
    case "openrouter":
      return process.env.OPENROUTER_MODEL ?? "alibaba/qwen3.7-plus";
    case "gemini":
      return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    case "anthropic":
      return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
  }
}

export function isProviderConfigured(provider: LLMProvider): boolean {
  switch (provider) {
    case "vllm":
      return Boolean(process.env.VLLM_BASE_URL);
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY);
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY);
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
  }
}

export function listProviderInfos(): ProviderInfo[] {
  return ALL_PROVIDERS.map((id) => ({
    id,
    label: PROVIDER_LABELS[id],
    model: getModelForProvider(id),
    configured: isProviderConfigured(id),
  }));
}

export function firstConfiguredProvider(): LLMProvider | null {
  return ALL_PROVIDERS.find(isProviderConfigured) ?? null;
}
