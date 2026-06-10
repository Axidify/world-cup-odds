import type { LLMClient } from "../types";
import { getModelForProvider } from "../config";
import { createOpenAICompatibleClient } from "./openai-compatible";

export function createOpenAIClient(): LLMClient {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return createOpenAICompatibleClient({
    config: { provider: "openai", model: getModelForProvider("openai") },
    apiKey,
  });
}
