import type { LLMProvider } from "@/lib/types";
import { getModelForProvider, isProviderConfigured } from "./config";
import type { LLMClient } from "./types";
import { createAnthropicClient } from "./providers/anthropic";
import { createGeminiClient } from "./providers/gemini";
import { createOpenAIClient } from "./providers/openai";
import { createOpenRouterClient } from "./providers/openrouter";
import { createVllmClient } from "./providers/vllm";
import { getActiveProvider, resolveActiveProvider } from "./settings";

export function createLLMClient(provider?: LLMProvider): LLMClient {
  const p = provider ?? getActiveProvider();
  if (!isProviderConfigured(p)) {
    throw new Error(`LLM provider "${p}" is not configured`);
  }
  switch (p) {
    case "vllm":
      return createVllmClient();
    case "openai":
      return createOpenAIClient();
    case "openrouter":
      return createOpenRouterClient();
    case "gemini":
      return createGeminiClient();
    case "anthropic":
      return createAnthropicClient();
  }
}

export async function checkProviderHealth(provider: LLMProvider): Promise<boolean> {
  if (!isProviderConfigured(provider)) return false;
  try {
    const client = createLLMClient(provider);
    return await client.healthCheck();
  } catch {
    return false;
  }
}

export function getActiveLLMInfo() {
  const provider = resolveActiveProvider();
  if (!provider) {
    return { provider: null, model: null, configured: false };
  }
  return {
    provider,
    model: getModelForProvider(provider),
    configured: true,
  };
}
