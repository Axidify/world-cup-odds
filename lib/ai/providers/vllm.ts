import type { LLMClient } from "../types";
import { getModelForProvider } from "../config";
import { createOpenAICompatibleClient } from "./openai-compatible";

export function createVllmClient(): LLMClient {
  const baseURL = process.env.VLLM_BASE_URL ?? "http://127.0.0.1:8000/v1";
  const model = getModelForProvider("vllm");
  return createOpenAICompatibleClient({
    config: { provider: "vllm", model },
    apiKey: process.env.VLLM_API_KEY ?? "not-needed",
    baseURL,
    maxTokens: Number(process.env.VLLM_MAX_TOKENS ?? 512),
    timeoutMs: Number(process.env.VLLM_TIMEOUT_MS ?? 120_000),
  });
}
